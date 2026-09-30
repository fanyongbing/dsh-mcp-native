/**
 * dsh-mcp-native — host half.
 *
 * Serves the `/mcp-native` JSON routes the browser half calls from the
 * Settings page. Every operation drives a mechanism DSH already owns:
 *
 * - list/status  `ctx.loader.entries()` filtered to `@deepseek-ai/dsh-mcp-client`
 * - start/stop   `ctx.pluginManager.setPluginEnabled(entryId, enabled)`
 *                (writes the `disabled` override into the profile patch file),
 *                falling back to `entry.update({ disabled })` + `tree.write()`
 * - restart      stop then start — the only way to force a fresh connect
 * - config edit  `ctx.configEditor.edit(entry, change)`, falling back to
 *                `entry.update({ config })` + `tree.write()`
 * - add/remove   `tree.create()` / `tree.remove()` — the file-backed include
 *                tree's own persistence path
 *
 * Nothing here reaches into MCP internals. `@deepseek-ai/dsh-mcp-client` owns
 * the connection and publishes no status API, so a row's *lifecycle* state is
 * reported as such and never claimed to mean "connected"; the tool list is the
 * only positive evidence a connection produced anything.
 * @module dsh-mcp-native
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CONFIG_FIELDS, MCP_PLUGIN_NAME, TRANSPORT_FALLBACK, matchKnownServer } from './catalog.js'
import { discoverLocalServers } from './discover.js'

/** Route prefix; the browser calls it document-relative as `mcp-native/<verb>`. */
const ROUTE_PREFIX = '/mcp-native'

/** Cordis `FiberState` members this half reports (PENDING 0 … UNLOADING 5). */
const FIBER_PENDING = 0
const FIBER_LOADING = 1
const FIBER_ACTIVE = 2
const FIBER_FAILED = 3
const FIBER_DISPOSED = 4

/** Required services: the route registry. Every other service is probed. */
export const inject = ['webServer']

/** Plugin name, used by the harness logger. */
export const name = 'mcp-native'

/**
 * Mount the `/mcp-native` routes.
 * @param ctx - host context carrying `webServer`.
 */
export function apply(ctx) {
  const handler = (req, res) => {
    handleRequest(ctx, req, res).catch((error) => {
      sendJson(res, 500, failure('internal', describeError(error)))
    })
  }
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler }),
    'dsh-mcp-native: /mcp-native routes',
  )
  // This plugin ships its own page, so it opts out of the schema-generated
  // settings form. The child injects the optional service, so the plugin runs
  // without Settings too.
  ctx.inject(['settings'], (child) => {
    try {
      child.effect(() => child.settings.configure({ auto: false }, ctx.fiber), 'dsh-mcp-native: own settings page')
    } catch {
      /* already configured for this fiber, or the host refuses a second policy */
    }
  })
  ctx.logger?.info?.('mcp-native: Settings → MCP 服务 is served from the live loader tree')
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

/** Read a bounded JSON body; an empty body reads as `{}`. */
async function readBody(req, maxBytes = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

/** Write one JSON envelope. */
function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  res.end(JSON.stringify(body))
}

/** Success envelope. */
function success(value) {
  return { ok: true, value }
}

/** Failure envelope. */
function failure(code, message, hint) {
  return { ok: false, error: hint === undefined ? { code, message } : { code, message, hint } }
}

/** Stable message for any thrown value. */
function describeError(error) {
  return error instanceof Error ? error.message : String(error)
}

/** Route one request to its verb. */
async function handleRequest(ctx, req, res) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const verb = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+|\/+$/g, '')
  if (req.method !== 'POST') {
    sendJson(res, 405, failure('method-not-allowed', '该接口只接受 POST'))
    return
  }
  const body = await readBody(req)
  switch (verb) {
    case 'list':
      sendJson(res, 200, success(await buildSnapshot(ctx)))
      return
    case 'detail':
      sendJson(res, 200, success(await buildDetail(ctx, requireId(body))))
      return
    case 'toggle':
      sendJson(res, 200, success(await toggleServer(ctx, requireId(body), body.enabled !== false)))
      return
    case 'restart':
      sendJson(res, 200, success(await restartServer(ctx, requireId(body))))
      return
    case 'save':
      sendJson(res, 200, success(await saveServer(ctx, requireId(body), body.config)))
      return
    case 'add':
      sendJson(res, 200, success(await addServer(ctx, body.config, body.id)))
      return
    case 'remove':
      sendJson(res, 200, success(await removeServer(ctx, requireId(body))))
      return
    case 'discover':
      sendJson(res, 200, success(await discoverLocalServers(typeof body.cwd === 'string' ? body.cwd : undefined)))
      return
    case 'import':
      sendJson(res, 200, success(await importServers(ctx, body.servers)))
      return
    case 'meta':
      sendJson(res, 200, success(meta(ctx)))
      return
    default:
      sendJson(res, 404, failure('unknown-verb', `未知接口：${verb}`))
  }
}

/** Validate the mandatory row id. */
function requireId(body) {
  const id = body?.id
  if (typeof id !== 'string' || id === '') throw new Error('缺少参数 id')
  return id
}

// ---------------------------------------------------------------------------
// Loader access
// ---------------------------------------------------------------------------

/** Every live loader entry mounted from the MCP client plugin. */
function mcpEntries(ctx) {
  const out = []
  let entries
  try {
    entries = ctx.loader?.entries?.() ?? []
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry?.options?.name === MCP_PLUGIN_NAME) out.push(entry)
  }
  return out
}

/** Find one MCP row by its loader id. */
function findEntry(ctx, id) {
  const entry = mcpEntries(ctx).find(candidate => candidate.options.id === id)
  if (entry === undefined) throw new Error(`找不到 MCP 行：${id}`)
  return entry
}

/**
 * The file-backed tree that owns this row.
 *
 * The profile's rows live in the Include tree created by app-boot, whose
 * `write()` persists to `<profile>/cordis.yml`. The Loader's own root tree has
 * a no-op `write()` — a row created there mounts and works for the session but
 * is gone after a restart — so every mutation verifies the tree it is about to
 * touch actually owns a file.
 * @param entry - the MCP loader row, when one exists.
 * @returns the Include tree, or undefined when no file-backed tree is reachable.
 */
function owningTree(ctx, entry) {
  const candidate = entry?.parent?.tree
  if (isFileBackedTree(candidate)) return candidate
  // No MCP row yet: borrow the tree any profile row belongs to. configEditor
  // exposes exactly the rows owned by the root Include.
  try {
    const editor = ctx.get?.('configEditor')
    const first = editor?.entries?.()[0]
    if (isFileBackedTree(first?.parent?.tree)) return first.parent.tree
  } catch {
    /* fall through to the generic scan */
  }
  try {
    for (const row of ctx.loader?.entries?.() ?? []) {
      const tree = row?.parent?.tree
      if (isFileBackedTree(tree) && tree.ctx?.fiber?.entry?.id === 'include') return tree
    }
  } catch {
    /* no file-backed tree reachable */
  }
  return undefined
}

/**
 * Whether a tree persists to a file.
 *
 * `Include` (the profile's own tree) carries a `filename`; the Loader's root
 * tree does not, and its `write()` is documented as a no-op.
 */
function isFileBackedTree(tree) {
  return tree !== undefined
    && tree !== null
    && typeof tree.write === 'function'
    && typeof tree.filename === 'string'
}

/** Persist the current tree state (the loader does the same for self-disable). */
function persistTree(ctx, entry) {
  const tree = owningTree(ctx, entry)
  if (tree === undefined) return false
  try {
    tree.write()
    return true
  } catch {
    return false
  }
}

/** Wait for the loader to settle after a mutation. */
async function settle(ctx) {
  try {
    await ctx.loader?.await?.()
  } catch {
    /* a failed entry still settles the tree; the next list reports it */
  }
}

/** Live tool schemas registered by one MCP server. */
function toolsOf(ctx, serverName) {
  const prefix = `mcp__${serverName}__`
  let schemas = []
  try {
    schemas = ctx.get?.('tools')?.schemas?.() ?? []
  } catch {
    return []
  }
  return schemas
    .filter(schema => typeof schema?.name === 'string' && schema.name.startsWith(prefix))
    .map(schema => ({
      name: schema.name,
      rawName: schema.name.slice(prefix.length),
      description: typeof schema.description === 'string' ? schema.description : '',
    }))
}

/**
 * Lifecycle verdict for one row.
 *
 * `running` means the plugin fiber is active — the row is mounted and the MCP
 * client has been given its chance to connect. It is NOT proof of a live
 * connection: with the default `failOnStartupError: false` the fiber stays
 * active even when the first connect failed. {@link toolsOf} is the only
 * positive evidence; the UI says so in words.
 */
function rowState(entry) {
  if (entry.disabled) return 'stopped'
  const fiber = entry.fiber
  if (fiber === undefined) return 'starting'
  if (fiber.state === FIBER_ACTIVE) return 'running'
  if (fiber.state === FIBER_FAILED || fiber.state === FIBER_DISPOSED) return 'failed'
  if (fiber.state === FIBER_LOADING || fiber.state === FIBER_PENDING) return 'starting'
  return 'starting'
}

/** Error text a failed row carries, when the fiber exposes one. */
function rowError(entry) {
  const fiber = entry.fiber
  const error = fiber?.error ?? fiber?._error
  if (error === undefined || error === null) return undefined
  return describeError(error)
}

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

/** Build the complete snapshot the settings page renders. */
async function buildSnapshot(ctx) {
  const overrides = configEditorOverrides(ctx)
  const entries = mcpEntries(ctx)
  const infos = await pluginInfoIndex(ctx)
  const servers = entries.map(entry => describeRow(ctx, entry, overrides, infos))
  const profile = profileFacts(ctx)
  const running = servers.filter(server => server.state === 'running').length
  const stopped = servers.filter(server => server.state === 'stopped').length
  return {
    servers,
    profile,
    fields: CONFIG_FIELDS,
    mcpPluginName: MCP_PLUGIN_NAME,
    capabilities: {
      configEditor: hasService(ctx, 'configEditor'),
      pluginManager: hasService(ctx, 'pluginManager'),
      tools: hasService(ctx, 'tools'),
    },
    counts: {
      total: servers.length,
      running,
      stopped,
      failed: servers.length - running - stopped,
      tools: servers.reduce((sum, server) => sum + server.toolCount, 0),
    },
  }
}

/** Whether a service is mounted on this context. */
function hasService(ctx, key) {
  try {
    return ctx.get?.(key) !== undefined
  } catch {
    return false
  }
}

/** Which entry ids carry an explicit override in the user's patch layer. */
function configEditorOverrides(ctx) {
  const map = new Map()
  try {
    const editor = ctx.get?.('configEditor')
    if (editor === undefined || editor === null) return map
    for (const item of editor.configuration()) {
      map.set(item.entry.options.id, item.override ?? {})
    }
  } catch {
    /* the editor is optional; the page still lists rows without it */
  }
  return map
}

/** `pluginManager.listPlugins()` indexed by the loader row id. */
async function pluginInfoIndex(ctx) {
  const map = new Map()
  const manager = ctx.get?.('pluginManager')
  if (manager === undefined || manager === null || typeof manager.listPlugins !== 'function') return map
  let rows
  try {
    rows = await manager.listPlugins()
  } catch {
    return map
  }
  if (!Array.isArray(rows)) return map
  for (const row of rows) {
    if (row?.moduleName !== MCP_PLUGIN_NAME) continue
    const entryId = typeof row.entryId === 'string' ? row.entryId : ''
    const rowId = entryId.includes(':') ? entryId.slice(entryId.lastIndexOf(':') + 1) : entryId
    if (rowId !== '') map.set(rowId, row)
  }
  return map
}

/** Profile paths the page shows in its header. */
function profileFacts(ctx) {
  let dir
  try {
    dir = ctx.get?.('profileContext')?.dir
  } catch {
    dir = undefined
  }
  if (typeof dir !== 'string' || dir === '') {
    const envDir = process.env.DSH_PROFILE_DIR
    dir = typeof envDir === 'string' ? envDir : undefined
  }
  return {
    name: process.env.DSH_PROFILE ?? undefined,
    dir: dir ?? undefined,
    treeFile: dir === undefined ? undefined : join(dir, 'cordis.yml'),
    patchFile: dir === undefined ? undefined : join(dir, 'cordis.patch.yml'),
    treeExists: dir === undefined ? false : existsSync(join(dir, 'cordis.yml')),
  }
}

/** One card's worth of facts. */
function describeRow(ctx, entry, overrides, infos) {
  const raw = readRawConfig(entry.options.config)
  const config = decodeConfig(raw)
  const serverName = typeof config.serverName === 'string' && config.serverName !== ''
    ? config.serverName
    : entry.options.id
  const transport = resolveTransport(config)
  const tools = toolsOf(ctx, serverName)
  const info = infos?.get(entry.options.id)
  return {
    id: entry.options.id,
    serverName,
    transport,
    state: rowState(entry),
    enabled: !entry.disabled,
    error: rowError(entry),
    origin: overrides.has(entry.options.id) ? 'patch' : 'base',
    readOnlyReason: info?.readOnlyReason ?? undefined,
    toolCount: tools.length,
    tools,
    description: describeServer(config, transport),
    command: stringOrUndefined(config.command),
    args: Array.isArray(config.args) ? config.args.filter(item => typeof item === 'string') : [],
    url: stringOrUndefined(config.url),
    cwd: stringOrUndefined(config.cwd),
    envKeys: Object.keys(config.env ?? {}),
    headerKeys: Object.keys(config.headers ?? {}),
    toolCallTimeoutMs: numberOrUndefined(config.toolCallTimeoutMs),
    failOnStartupError: config.failOnStartupError === true,
    reconnectEnabled: config.reconnect?.enabled !== false,
    reconnectMaxAttempts: numberOrUndefined(config.reconnect?.maxAttempts),
    /** Pretty-printed raw config, JS expressions included. */
    raw: JSON.stringify(raw, null, 2),
  }
}

/** Full record for the editor dialog: every field, secrets included, locally. */
async function buildDetail(ctx, id) {
  const entry = findEntry(ctx, id)
  const overrides = configEditorOverrides(ctx)
  const infos = await pluginInfoIndex(ctx)
  const row = describeRow(ctx, entry, overrides, infos)
  const raw = readRawConfig(entry.options.config)
  return {
    ...row,
    config: decodeConfig(raw),
    raw: JSON.stringify(raw, null, 2),
    fields: CONFIG_FIELDS,
    override: overrides.get(id) ?? {},
    options: { id: entry.options.id, name: entry.options.name, disabled: Boolean(entry.disabled) },
  }
}

/** Title, one-line summary and long form for the card's "MCP 说明". */
function describeServer(config, transport) {
  const haystack = [config.command, ...(Array.isArray(config.args) ? config.args : []), config.url]
    .filter(item => typeof item === 'string')
    .join(' ')
    .toLowerCase()
  const known = matchKnownServer(haystack)
  if (known !== undefined) {
    return { title: known.title, summary: known.summary, detail: known.detail, docs: known.docs, source: 'catalog' }
  }
  const launch = [config.command, ...(Array.isArray(config.args) ? config.args : [])]
    .filter(item => typeof item === 'string' && item !== '')
    .join(' ')
  return {
    title: transport === 'stdio' ? '本地 stdio 服务器' : '远端 Streamable HTTP 服务器',
    summary: TRANSPORT_FALLBACK[transport] ?? TRANSPORT_FALLBACK.stdio,
    detail: transport === 'stdio'
      ? `由 dsh 启动该进程并接管其标准输入输出：${launch === '' ? '（尚未填写命令）' : launch}`
      : `dsh 直接连接该地址，不启动本地进程：${stringOrUndefined(config.url) ?? '（尚未填写地址）'}`,
    source: 'derived',
  }
}

/** Resolve the effective transport, inferring it when the row omits one. */
function resolveTransport(config) {
  if (config.transport === 'stdio' || config.transport === 'streamable-http') return config.transport
  if (typeof config.url === 'string' && config.url !== '') return 'streamable-http'
  return 'stdio'
}

/** Read the row config as plain JSON, preserving `!!js` markers. */
function readRawConfig(config) {
  const source = config === null || typeof config !== 'object' ? {} : config
  try {
    const text = JSON.stringify(source, (key, value) => {
      if (typeof value === 'function') return undefined
      if (typeof value === 'bigint') return String(value)
      return value
    })
    return text === undefined ? {} : JSON.parse(text)
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Write side
// ---------------------------------------------------------------------------

/**
 * Start or stop one server.
 *
 * Prefers `pluginManager.setPluginEnabled`, which records the intent in the
 * profile's patch layer so it survives a restart; falls back to the loader's
 * own `disabled` flag when the manager is absent or refuses.
 * @returns the outcome, including which mechanism actually applied it.
 */
async function toggleServer(ctx, id, enabled) {
  const entry = findEntry(ctx, id)
  if (enabled === !entry.disabled) {
    return { id, enabled, changed: false, mechanism: 'none', persisted: false, state: rowState(entry) }
  }
  const info = (await pluginInfoIndex(ctx)).get(id)
  const managed = info !== undefined && info.readOnlyReason === undefined
  if (managed) {
    const result = await ctx.get('pluginManager').setPluginEnabled(info.entryId, enabled)
    await settle(ctx)
    return {
      id,
      enabled,
      changed: true,
      mechanism: 'pluginManager',
      persisted: true,
      overridden: result === 'overridden',
      restartRequired: result === 'restart-required',
      state: rowState(findEntryIfPresent(ctx, id) ?? entry),
    }
  }
  await entry.update(enabled ? { disabled: null } : { disabled: true }, false, true)
  const persisted = persistTree(ctx, entry)
  await settle(ctx)
  return {
    id,
    enabled,
    changed: true,
    mechanism: 'loader',
    persisted,
    readOnlyReason: info?.readOnlyReason,
    state: rowState(entry),
  }
}

/** Stop then start — the only way to force a fresh MCP connect. */
async function restartServer(ctx, id) {
  const entry = findEntry(ctx, id)
  if (entry.disabled) {
    const started = await toggleServer(ctx, id, true)
    return { ...started, restarted: true }
  }
  await toggleServer(ctx, id, false)
  const started = await toggleServer(ctx, id, true)
  return { ...started, restarted: true, id }
}

/** Re-read a row that a reload may have replaced. */
function findEntryIfPresent(ctx, id) {
  return mcpEntries(ctx).find(candidate => candidate.options.id === id)
}

/** Rewrite one row's config; the MCP client reconnects on the new one. */
async function saveServer(ctx, id, input) {
  const entry = findEntry(ctx, id)
  const next = buildConfig(entry, input)
  validateConfig(next)
  const editor = ctx.get?.('configEditor')
  if (editor !== undefined && editor !== null && typeof editor.edit === 'function') {
    await editor.edit(entry, () => next)
    await settle(ctx)
    return { id, persisted: true, mechanism: 'configEditor', state: rowState(findEntryIfPresent(ctx, id) ?? entry) }
  }
  await entry.update({ config: next }, false, true)
  const persisted = persistTree(ctx, entry)
  await settle(ctx)
  return { id, persisted, mechanism: 'loader', state: rowState(entry) }
}

/** Mount a new MCP server row in the profile tree. */
async function addServer(ctx, input, requestedId) {
  const existing = mcpEntries(ctx)
  const tree = owningTree(ctx, existing[0])
  if (tree === undefined || typeof tree.create !== 'function') {
    throw new Error('找不到 profile 的配置文件树（cordis.yml），无法新增 MCP 服务器')
  }
  const config = buildConfig(undefined, input)
  validateConfig(config, existing)
  const id = uniqueId(tree, sanitizeId(requestedId, config.serverName))
  await tree.create({ id, name: MCP_PLUGIN_NAME, config })
  await settle(ctx)
  return { id, serverName: config.serverName, state: rowState(findEntry(ctx, id)), treeFile: tree.filename }
}

/** Unmount and delete one MCP server row. */
async function removeServer(ctx, id) {
  const entry = findEntry(ctx, id)
  const tree = owningTree(ctx, entry)
  if (tree === undefined || typeof tree.remove !== 'function') {
    throw new Error('找不到 profile 的配置文件树（cordis.yml），无法删除 MCP 服务器')
  }
  tree.remove(id)
  await settle(ctx)
  return { id, removed: true }
}

/** Add every discovered server the client selected. */
async function importServers(ctx, servers) {
  if (!Array.isArray(servers) || servers.length === 0) throw new Error('没有选择要导入的服务器')
  const added = []
  const failed = []
  for (const server of servers) {
    try {
      added.push(await addServer(ctx, server, server?.suggestedId))
    } catch (error) {
      failed.push({ name: server?.serverName ?? server?.originalName ?? '未知', message: describeError(error) })
    }
  }
  return { added, failed }
}

/** Loader facts for the page header. */
function meta(ctx) {
  const tree = owningTree(ctx, mcpEntries(ctx)[0])
  return {
    mcpPluginName: MCP_PLUGIN_NAME,
    treeFile: tree === undefined ? undefined : tree.filename,
    fields: CONFIG_FIELDS,
    profile: profileFacts(ctx),
    capabilities: {
      configEditor: hasService(ctx, 'configEditor'),
      pluginManager: hasService(ctx, 'pluginManager'),
      tools: hasService(ctx, 'tools'),
    },
  }
}

/**
 * Build a loader-ready config object from the editor payload.
 *
 * `transport` is always written explicitly: the MCP client's schema does not
 * require it, and a row that omits it reaches `Client.connect(undefined)` and
 * fails silently at runtime.
 * @param entry - existing row when editing, undefined when adding.
 * @param input - the editor payload; `__raw` carries a hand-written JSON config.
 */
function buildConfig(entry, input) {
  const source = input === null || typeof input !== 'object' ? {} : input
  if (typeof source.__raw === 'string' && source.__raw.trim() !== '') {
    return normalizeRaw(parseRawJson(source.__raw))
  }
  const next = normalizeInput(source)
  if (entry === undefined) return next
  return mergePreservingUnknown(decodeConfig(readRawConfig(entry.options.config)), next)
}

/** Parse the advanced editor's JSON, with a readable error. */
function parseRawJson(text) {
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('顶层必须是 JSON 对象')
    }
    return parsed
  } catch (error) {
    throw new Error(`JSON 配置无法解析：${describeError(error)}`)
  }
}

/** Normalize a hand-written config: `!!js` strings become loader expressions. */
function normalizeRaw(parsed) {
  const out = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'env' || key === 'headers') out[key] = decodeJsMap(value)
    else out[key] = typeof value === 'string' ? decodeJsValue(value) : value
  }
  return out
}

/** Map the editor's flat form onto the loader config. */
function normalizeInput(source) {
  const config = {}
  const url = trim(source.url)
  const declared = typeof source.transport === 'string' ? source.transport.trim() : ''
  if (declared !== '' && declared !== 'stdio' && declared !== 'streamable-http') {
    throw new Error(`不支持的 transport：${declared}（只支持 stdio 与 streamable-http）`)
  }
  const transport = declared !== '' ? declared : (url === undefined ? 'stdio' : 'streamable-http')
  config.transport = transport
  const serverName = trim(source.serverName)
  if (serverName !== undefined) config.serverName = serverName
  if (transport === 'stdio') {
    assignIfPresent(config, 'command', trim(source.command))
    const args = stringList(source.args)
    if (args.length > 0) config.args = args
    const env = decodeJsMap(source.env)
    if (Object.keys(env).length > 0) config.env = env
    assignIfPresent(config, 'cwd', trim(source.cwd))
  } else {
    assignIfPresent(config, 'url', url)
    const headers = decodeJsMap(source.headers)
    if (Object.keys(headers).length > 0) config.headers = headers
  }
  assignIfPresent(config, 'toolCallTimeoutMs', positiveNumber(source.toolCallTimeoutMs))
  assignIfPresent(config, 'maxInstructionBytes', positiveNumber(source.maxInstructionBytes))
  if (source.failOnStartupError === true) config.failOnStartupError = true
  const reconnect = decodeReconnect(source.reconnect)
  if (Object.keys(reconnect).length > 0) config.reconnect = reconnect
  return config
}

/**
 * Keep every field of the existing config the form does not model, so a save
 * never silently drops an option a future DSH version added.
 */
function mergePreservingUnknown(current, next) {
  const merged = { ...current, ...next }
  if (next.transport === 'streamable-http') {
    delete merged.command
    delete merged.args
    delete merged.env
    delete merged.cwd
  } else if (next.transport === 'stdio') {
    delete merged.url
    delete merged.headers
  }
  return merged
}

/**
 * Validate the shape the MCP client's own schema enforces.
 * @param config - the config about to be written.
 * @param existing - other MCP rows, when adding, for the name-uniqueness rule.
 */
function validateConfig(config, existing) {
  const name = config.serverName
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(name)) {
    throw new Error('serverName 只能包含字母、数字、下划线和连字符，长度 1–32')
  }
  if (config.transport === 'stdio') {
    if (typeof config.command !== 'string' || config.command.trim() === '') {
      throw new Error('stdio 传输必须填写 command')
    }
  } else if (config.transport === 'streamable-http') {
    if (typeof config.url !== 'string' || config.url.trim() === '') {
      throw new Error('streamable-http 传输必须填写 url')
    }
  } else {
    throw new Error(`不支持的 transport：${String(config.transport)}（只支持 stdio 与 streamable-http）`)
  }
  if (Array.isArray(existing)) {
    const taken = existing.some(entry => {
      const other = decodeConfig(readRawConfig(entry.options.config))
      return other.serverName === name
    })
    if (taken) throw new Error(`serverName "${name}" 已被其他 MCP 行占用，请换一个`)
  }
}

/** A loader row id that is unique inside the tree. */
function uniqueId(tree, base) {
  let candidate = base
  let counter = 2
  while (tree.store?.[candidate] !== undefined) {
    candidate = `${base}-${counter}`
    counter += 1
  }
  return candidate
}

/** Make a picker-supplied id safe, falling back to the server name. */
function sanitizeId(requestedId, serverName) {
  const raw = typeof requestedId === 'string' && requestedId !== '' ? requestedId : `mcp-${serverName}`
  const cleaned = raw.replace(/[^A-Za-z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return cleaned === '' ? `mcp-${serverName}` : cleaned
}

/** Trimmed string, or undefined for a blank. */
function trim(value) {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text === '' ? undefined : text
}

/** A positive finite number, or undefined. */
function positiveNumber(value) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** Normalize the editor's newline-separated argument list. */
function stringList(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item !== '')
  if (typeof value !== 'string') return []
  return value.split('\n').map(line => line.trim()).filter(line => line !== '')
}

/** Set a key only when the value survived validation. */
function assignIfPresent(target, key, value) {
  if (value !== undefined) target[key] = value
}

/** Reconnect overrides the user actually changed. */
function decodeReconnect(input) {
  const source = input === null || typeof input !== 'object' ? {} : input
  const out = {}
  if (source.enabled === false) out.enabled = false
  else if (source.enabled === true) out.enabled = true
  const initial = positiveNumber(source.initialDelayMs)
  if (initial !== undefined) out.initialDelayMs = initial
  const max = positiveNumber(source.maxDelayMs)
  if (max !== undefined) out.maxDelayMs = max
  const attempts = positiveNumber(source.maxAttempts)
  if (attempts !== undefined) out.maxAttempts = Math.round(attempts)
  return out
}

// ---------------------------------------------------------------------------
// `!!js` round-tripping
// ---------------------------------------------------------------------------

/** Render a raw config for the browser: `!!js` nodes become editable text. */
function decodeConfig(config) {
  const source = config === null || typeof config !== 'object' ? {} : config
  const out = {}
  for (const [key, value] of Object.entries(source)) out[key] = decodeValue(value)
  return out
}

/** Recursively turn `{ __jsExpr }` nodes into `"!!js <expr>"` strings. */
function decodeValue(value) {
  if (Array.isArray(value)) return value.map(decodeValue)
  if (value === null || typeof value !== 'object') return value
  const keys = Object.keys(value)
  if (keys.length === 1 && typeof value.__jsExpr === 'string') return `!!js ${value.__jsExpr}`
  const out = {}
  for (const [key, item] of Object.entries(value)) out[key] = decodeValue(item)
  return out
}

/** Turn `"!!js <expr>"` strings back into the loader's expression node. */
function decodeJsValue(value) {
  if (typeof value === 'string' && value.startsWith('!!js ')) {
    return { __jsExpr: value.slice(5).trim() }
  }
  return value
}

/** Apply {@link decodeJsValue} to every value of a string map. */
function decodeJsMap(input) {
  const source = input === null || typeof input !== 'object' || Array.isArray(input) ? {} : input
  const out = {}
  for (const [key, value] of Object.entries(source)) {
    const name = String(key).trim()
    if (name === '') continue
    out[name] = typeof value === 'string' ? decodeJsValue(value) : value
  }
  return out
}

/** Strings survive only when non-empty. */
function stringOrUndefined(value) {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Numbers survive only when finite. */
function numberOrUndefined(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
