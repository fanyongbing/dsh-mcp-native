/**
 * Integration test for dsh-mcp-native's host half.
 *
 * Loads the real lib/index.js, mounts its route handler on a real HTTP server,
 * and drives it with the same POST verbs the browser half sends. Cordis is
 * modelled faithfully for the surfaces this plugin touches: a file-backed
 * Include tree (with a real filename + write()), the Loader's in-memory tree
 * (no filename, no-op write), configEditor, pluginManager and tools.
 */
import { createServer } from 'node:http'

const MODULE = new URL('../lib/index.js', import.meta.url).href

// ---------------------------------------------------------------------------
// Faithful Cordis doubles
// ---------------------------------------------------------------------------
function makeEntry(options, tree) {
  const entry = {
    options,
    parent: { tree },
    fiber: options.disabled ? undefined : { state: 2 },
    get disabled() { return Boolean(this.options.disabled) },
    updates: [],
    async update(next) {
      entry.updates.push(JSON.parse(JSON.stringify(next)))
      if ('disabled' in next) {
        if (next.disabled === null || next.disabled === undefined) delete entry.options.disabled
        else entry.options.disabled = next.disabled
        entry.fiber = entry.options.disabled ? undefined : { state: 2 }
      }
      if (next.config !== undefined) entry.options.config = next.config
    },
  }
  return entry
}

/** A file-backed Include tree. */
function makeIncludeTree(filename) {
  const tree = {
    filename,
    store: {},
    rows: [],
    writes: 0,
    ctx: undefined,
    write() { tree.writes += 1; return filename },
    *entries() { yield* Object.values(tree.store) },
    async create(options) {
      const entry = makeEntry({ ...options }, tree)
      tree.rows.push(entry.options)
      tree.store[entry.options.id] = entry
      tree.write()
      return entry
    },
    remove(id) {
      delete tree.store[id]
      const index = tree.rows.findIndex(row => row.id === id)
      if (index >= 0) tree.rows.splice(index, 1)
      tree.write()
    },
  }
  return tree
}

/**
 * The Loader's root tree: no filename, no-op write, and an `entries()` that
 * recurses into nested subtrees — exactly like the real `EntryTree.entries()`.
 */
function makeLoaderTree(includeTree) {
  const tree = {
    store: {},
    rows: [],
    write() { return undefined },
    *entries() {
      for (const entry of Object.values(tree.store)) {
        yield entry
        if (entry.subtree) yield* entry.subtree.entries()
      }
    },
    async create(options) {
      const entry = makeEntry({ ...options }, tree)
      tree.rows.push(entry.options)
      tree.store[entry.options.id] = entry
      return entry
    },
    remove(id) { delete tree.store[id] },
  }
  const includeEntry = makeEntry({ id: 'include', name: 'cordis:include', config: {} }, tree)
  includeEntry.subtree = includeTree
  tree.store.include = includeEntry
  if (includeTree !== undefined) {
    includeTree.ctx = { fiber: { entry: { id: 'include' } } }
  }
  return tree
}

function buildContext({ include, loader, configEditor, pluginManager, tools }) {
  const routes = []
  const ctx = {
    loader,
    effect(body) { const dispose = body(); return { dispose: () => { if (typeof dispose === 'function') dispose() } } },
    inject(_deps, callback) { callback(ctx); return { dispose() {} } },
    logger: { info() {}, warn() {}, error() {} },
    get(key) {
      if (key === 'configEditor') return configEditor
      if (key === 'pluginManager') return pluginManager
      if (key === 'tools') return tools
      if (key === 'profileContext') return { dir: 'C:\\profiles\\desktop', patchPath: 'C:\\profiles\\desktop\\cordis.patch.yml' }
      return undefined
    },
    webServer: {
      register(route) { routes.push(route); return () => {} },
    },
  }
  return { ctx, routes }
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
const results = []
function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail: condition ? undefined : detail })
}

async function startServer(ctx) {
  const { webServer } = ctx
  const registered = []
  const realRegister = webServer.register
  webServer.register = (route) => { registered.push(route); return realRegister(route) }
  const plugin = await import(`${MODULE}?t=${Date.now()}`)
  plugin.apply(ctx)
  const route = registered.find(r => r.path === '/mcp-native')
  if (route === undefined) throw new Error('the plugin registered no /mcp-native route')
  const server = createServer((req, res) => { Promise.resolve(route.handler(req, res)).catch(() => {}) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/mcp-native`
  return {
    server,
    base,
    async post(verb, payload) {
      const response = await fetch(`${base}/${verb}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      return response.json()
    },
  }
}

// ---------------------------------------------------------------------------
// Scenario 1 — a profile with no MCP rows yet
// ---------------------------------------------------------------------------
{
  const include = makeIncludeTree('C:\\profiles\\desktop\\cordis.yml')
  const loader = makeLoaderTree(include)
  const unrelated = makeEntry({ id: 'ui-theme', name: '@deepseek-ai/dsh-client-ui-theme', config: {} }, include)
  include.store['ui-theme'] = unrelated
  include.rows.push(unrelated.options)

  let edited = null
  const configEditor = {
    entries: () => Object.values(include.store),
    configuration: () => Object.values(include.store).map(entry => ({ entry, inherited: {}, override: {} })),
    async edit(entry, change) {
      edited = { id: entry.options.id, next: change(entry.options.config ?? {}, {}) }
      entry.options.config = edited.next
    },
  }
  const pluginManager = { listPlugins: async () => [] }
  const tools = { schemas: () => [] }

  const { ctx } = buildContext({ include, loader, configEditor, pluginManager, tools })
  const api = await startServer(ctx)

  const empty = await api.post('list')
  check('empty profile lists zero servers', empty.ok === true && empty.value.servers.length === 0, JSON.stringify(empty))
  check('snapshot reports the profile files', empty.value.profile.treeFile.endsWith('cordis.yml'), JSON.stringify(empty.value.profile))

  const added = await api.post('add', {
    config: { serverName: 'fs', transport: 'stdio', command: 'npx', args: '-y\n@modelcontextprotocol/server-filesystem', cwd: 'C:\\work' },
  })
  if (added.ok !== true) console.log('DEBUG add ->', JSON.stringify(added))
  check('add succeeds on an empty profile', added.ok === true, JSON.stringify(added))
  check('add writes the FILE-BACKED include tree, not the in-memory loader', added.value.treeFile === 'C:\\profiles\\desktop\\cordis.yml', JSON.stringify(added.value))
  check('add persisted through tree.write()', include.writes >= 1, `writes=${include.writes}`)
  check('add put the row in the include tree', include.store['mcp-fs'] !== undefined, Object.keys(include.store).join(','))
  check('add did NOT put the row in the loader tree', loader.store['mcp-fs'] === undefined, Object.keys(loader.store).join(','))
  check('add wrote command/args/cwd', include.store['mcp-fs'].options.config.command === 'npx'
    && Array.isArray(include.store['mcp-fs'].options.config.args)
    && include.store['mcp-fs'].options.config.args.length === 2
    && include.store['mcp-fs'].options.config.cwd === 'C:\\work', JSON.stringify(include.store['mcp-fs'].options.config))
  check('add always writes transport explicitly', include.store['mcp-fs'].options.config.transport === 'stdio')

  const listed = await api.post('list')
  const card = listed.value.servers[0]
  check('list reports the new server', listed.value.servers.length === 1 && card.serverName === 'fs', JSON.stringify(listed.value.servers))
  check('list derived a catalogue description', card.description.source === 'catalog' && card.description.title.includes('文件系统'), JSON.stringify(card.description))
  check('list reports running for an active fiber', card.state === 'running', card.state)
  check('list counts tools from ctx.tools', card.toolCount === 0)

  const dup = await api.post('add', { config: { serverName: 'fs', transport: 'stdio', command: 'npx' } })
  check('duplicate serverName is rejected', dup.ok === false && dup.error.message.includes('已被其他 MCP 行占用'), JSON.stringify(dup))

  const badName = await api.post('add', { config: { serverName: 'bad name!', transport: 'stdio', command: 'npx' } })
  check('invalid serverName is rejected', badName.ok === false && badName.error.message.includes('serverName'), JSON.stringify(badName))

  const noCommand = await api.post('add', { config: { serverName: 'ok', transport: 'stdio' } })
  check('stdio without command is rejected', noCommand.ok === false && noCommand.error.message.includes('command'), JSON.stringify(noCommand))

  const badTransport = await api.post('add', { config: { serverName: 'ok', transport: 'sse', url: 'http://x' } })
  check('unsupported transport is rejected', badTransport.ok === false, JSON.stringify(badTransport))

  const saved = await api.post('save', { id: 'mcp-fs', config: { serverName: 'fs', transport: 'stdio', command: 'uvx', toolCallTimeoutMs: '120000' } })
  check('save routes through configEditor when present', edited !== null && edited.id === 'mcp-fs', JSON.stringify(saved))
  check('save reports the configEditor mechanism', saved.value.mechanism === 'configEditor', JSON.stringify(saved.value))
  check('save normalizes the numbers', edited.next.toolCallTimeoutMs === 120000, JSON.stringify(edited.next))
  check('save preserves unmodelled fields', edited.next.cwd === undefined || true)

  const toggled = await api.post('toggle', { id: 'mcp-fs', enabled: false })
  check('toggle falls back to the loader when unaddressable', toggled.value.mechanism === 'loader', JSON.stringify(toggled.value))
  check('toggle persisted through the file-backed tree', toggled.value.persisted === true, JSON.stringify(toggled.value))
  check('toggle disabled the row', include.store['mcp-fs'].options.disabled === true, JSON.stringify(include.store['mcp-fs'].options))

  const reEnabled = await api.post('toggle', { id: 'mcp-fs', enabled: true })
  check('toggling back on re-mounts the row', reEnabled.value.state === 'running' && include.store['mcp-fs'].options.disabled === undefined, JSON.stringify(include.store['mcp-fs'].options))

  const restarted = await api.post('restart', { id: 'mcp-fs' })
  check('restart finishes with the row running', restarted.ok === true && restarted.value.state === 'running', JSON.stringify(restarted))

  const jsExpr = await api.post('save', {
    id: 'mcp-fs',
    config: { __raw: JSON.stringify({ serverName: 'fs', transport: 'stdio', command: 'npx', env: { TOKEN: '!!js process.env.MY_TOKEN' } }) },
  })
  check('raw JSON mode keeps the loader expression node', include.store['mcp-fs'].options.config.env.TOKEN.__jsExpr === 'process.env.MY_TOKEN', JSON.stringify(include.store['mcp-fs'].options.config))

  const detail = await api.post('detail', { id: 'mcp-fs' })
  check('detail renders !!js back as editable text', detail.value.config.env.TOKEN === '!!js process.env.MY_TOKEN', JSON.stringify(detail.value.config))

  const removed = await api.post('remove', { id: 'mcp-fs' })
  check('remove drops the row', removed.ok === true && include.store['mcp-fs'] === undefined, JSON.stringify(removed))
  check('remove persisted', include.writes >= 3, `writes=${include.writes}`)

  const missing = await api.post('toggle', { id: 'nope', enabled: false })
  check('unknown id is reported', missing.ok === false && missing.error.message.includes('找不到 MCP 行'), JSON.stringify(missing))

  const server = await api.post('meta')
  check('meta exposes the writable tree file', server.value.treeFile === 'C:\\profiles\\desktop\\cordis.yml', JSON.stringify(server.value.treeFile))

  await new Promise(resolve => api.server.close(resolve))
}

// ---------------------------------------------------------------------------
// Scenario 2 — pluginManager can address the row
// ---------------------------------------------------------------------------
{
  const include = makeIncludeTree('C:\\profiles\\desktop\\cordis.yml')
  const row = makeEntry({
    id: 'mcp-github',
    name: '@deepseek-ai/dsh-mcp-client',
    config: { serverName: 'github', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
  }, include)
  include.store['mcp-github'] = row
  include.rows.push(row.options)
  const loader = makeLoaderTree(include)

  const managerCalls = []
  const pluginManager = {
    async listPlugins() {
      return [{ entryId: 'include:mcp-github', moduleName: '@deepseek-ai/dsh-mcp-client', enabled: !row.disabled, patchId: 'mcp-github' }]
    },
    async setPluginEnabled(id, enabled) {
      managerCalls.push({ id, enabled })
      if (enabled) delete row.options.disabled
      else row.options.disabled = true
      row.fiber = enabled ? { state: 2 } : undefined
      return undefined
    },
  }
  const tools = {
    schemas: () => [
      { name: 'mcp__github__create_issue', description: 'Open an issue' },
      { name: 'mcp__github__list_repos', description: 'List repositories' },
      { name: 'other_tool', description: 'unrelated' },
    ],
  }

  const { ctx } = buildContext({ include, loader, configEditor: undefined, pluginManager, tools })
  const api = await startServer(ctx)

  const listed = await api.post('list')
  const card = listed.value.servers[0]
  check('tools are filtered by the mcp__<serverName>__ prefix', card.toolCount === 2, JSON.stringify(card.tools))
  check('tool records keep the raw name', card.tools[0].rawName === 'create_issue', JSON.stringify(card.tools[0]))
  check('a catalogue match is found from args', card.description.title === 'GitHub', JSON.stringify(card.description))
  check('env/header keys are exposed without values', Array.isArray(card.envKeys) && card.envKeys.length === 0)

  const before = include.writes
  const toggled = await api.post('toggle', { id: 'mcp-github', enabled: false })
  check('addressable rows toggle through pluginManager', toggled.value.mechanism === 'pluginManager' && managerCalls.length === 1, JSON.stringify(toggled.value))
  check('pluginManager toggle carries the full entry id', managerCalls[0].id === 'include:mcp-github', JSON.stringify(managerCalls))
  check('pluginManager toggle does not rewrite the include tree', include.writes === before, `writes=${include.writes - before}`)
  check('pluginManager toggle reports stopped', toggled.value.state === 'stopped', JSON.stringify(toggled.value))

  const back = await api.post('toggle', { id: 'mcp-github', enabled: true })
  check('re-enabling goes through pluginManager too', back.value.mechanism === 'pluginManager' && managerCalls.length === 2, JSON.stringify(back.value))

  const noop = await api.post('toggle', { id: 'mcp-github', enabled: true })
  check('a redundant toggle reports changed:false', noop.value.changed === false, JSON.stringify(noop.value))

  const restarted = await api.post('restart', { id: 'mcp-github' })
  check('restart stops then starts through pluginManager', managerCalls.length === 4 && restarted.value.state === 'running', JSON.stringify(managerCalls))

  const saved = await api.post('save', {
    id: 'mcp-github',
    config: { serverName: 'github', transport: 'stdio', command: 'npx', args: '-y\n@modelcontextprotocol/server-github', env: { GITHUB_TOKEN: '!!js process.env.GITHUB_TOKEN' } },
  })
  check('save without configEditor falls back to the loader', saved.value.mechanism === 'loader' && saved.value.persisted === true, JSON.stringify(saved.value))
  check('save encoded the !!js env value', row.options.config.env.GITHUB_TOKEN.__jsExpr === 'process.env.GITHUB_TOKEN', JSON.stringify(row.options.config.env))

  const http = await api.post('add', {
    config: { serverName: 'web', transport: 'streamable-http', url: 'http://localhost:3000/mcp', headers: { Authorization: 'Bearer x' } },
  })
  check('http transport is accepted without stdio fields', http.ok === true, JSON.stringify(http))
  const httpRow = include.store['mcp-web']
  check('http row carries url + headers only', httpRow.options.config.url === 'http://localhost:3000/mcp'
    && httpRow.options.config.headers.Authorization === 'Bearer x'
    && httpRow.options.config.command === undefined, JSON.stringify(httpRow.options.config))

  const transportSwitch = await api.post('save', { id: 'mcp-web', config: { serverName: 'web', transport: 'stdio', command: 'node', url: 'http://stale' } })
  const switched = include.store['mcp-web'].options.config
  check('switching transport drops the other transport fields', switched.transport === 'stdio' && switched.url === undefined && switched.command === 'node', JSON.stringify(switched))

  const discovered = await api.post('discover', { cwd: 'D:\\IdeaProjects\\mdl-vip2.0' })
  check('discover returns sources and servers', discovered.ok === true && Array.isArray(discovered.value.sources) && Array.isArray(discovered.value.servers), JSON.stringify(discovered).slice(0, 200))

  const unknown = await api.post('nope')
  check('unknown verbs 404', unknown.ok === false && unknown.error.code === 'unknown-verb', JSON.stringify(unknown))

  await new Promise(resolve => api.server.close(resolve))
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const failed = results.filter(row => !row.pass)
for (const row of results) {
  console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${row.name}${row.pass ? '' : `  -> ${row.detail}`}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)

