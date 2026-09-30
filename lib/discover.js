/**
 * Local-machine MCP discovery: read the well-known MCP configuration files
 * other clients on this machine keep, and offer their servers for import.
 *
 * Everything here is read-only and best-effort: a missing, unreadable, or
 * malformed candidate is reported as a skip, never thrown.
 * @module dsh-mcp-native/discover
 */

import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Guard against reading a giant unrelated file by accident. */
const MAX_CANDIDATE_BYTES = 4 * 1024 * 1024

/**
 * Build the candidate list for this machine.
 * @param cwd - the session working directory, when one is known.
 * @returns descriptors with a resolved absolute path each.
 */
export function discoveryCandidates(cwd) {
  const home = homedir()
  const appData = process.env.APPDATA ?? join(home, 'AppData', 'Roaming')
  const candidates = [
    { id: 'claude-desktop', label: 'Claude Desktop', path: join(appData, 'Claude', 'claude_desktop_config.json') },
    { id: 'claude-code', label: 'Claude Code (~/.claude.json)', path: join(home, '.claude.json') },
    { id: 'cursor', label: 'Cursor', path: join(home, '.cursor', 'mcp.json') },
    { id: 'windsurf', label: 'Windsurf', path: join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    { id: 'vscode', label: 'VS Code (用户级)', path: join(appData, 'Code', 'User', 'mcp.json') },
  ]
  if (typeof cwd === 'string' && cwd !== '') {
    candidates.push({ id: 'project-mcp', label: '项目 .mcp.json', path: join(cwd, '.mcp.json') })
    candidates.push({ id: 'project-claude', label: '项目 .claude/settings.json', path: join(cwd, '.claude', 'settings.json') })
  }
  return candidates
}

/**
 * Read every candidate and normalize the servers it declares.
 * @param cwd - the session working directory, when one is known.
 * @returns `{ sources, servers }`; `sources` records every candidate's state.
 */
export async function discoverLocalServers(cwd) {
  const sources = []
  const servers = []
  for (const candidate of discoveryCandidates(cwd)) {
    const record = { id: candidate.id, label: candidate.label, path: candidate.path, status: 'missing', count: 0, error: undefined }
    if (!existsSync(candidate.path)) {
      sources.push(record)
      continue
    }
    try {
      const info = await stat(candidate.path)
      if (info.size > MAX_CANDIDATE_BYTES) {
        record.status = 'skipped'
        record.error = `文件过大（${info.size} 字节），已跳过`
        sources.push(record)
        continue
      }
      const text = await readFile(candidate.path, 'utf8')
      const parsed = JSON.parse(stripJsonComments(text))
      const map = findServerMap(parsed)
      if (map === undefined) {
        record.status = 'empty'
        sources.push(record)
        continue
      }
      for (const [name, value] of Object.entries(map)) {
        const normalized = normalizeServer(name, value)
        if (normalized === undefined) continue
        servers.push({ ...normalized, sourceId: candidate.id, sourceLabel: candidate.label, sourcePath: candidate.path })
      }
      record.status = 'ok'
      record.count = servers.filter(server => server.sourceId === candidate.id).length
      sources.push(record)
    } catch (error) {
      record.status = 'error'
      record.error = error instanceof Error ? error.message : String(error)
      sources.push(record)
    }
  }
  return { sources, servers }
}

/** Locate the server map inside the several shapes these clients use. */
function findServerMap(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  const record = parsed
  for (const key of ['mcpServers', 'servers', 'mcp']) {
    const candidate = record[key]
    if (candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate
  }
  return undefined
}

/** Tolerate the JSON5-ish comments some clients leave in their config. */
function stripJsonComments(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/**
 * Normalize one foreign server declaration into this plugin's editor shape.
 * @returns the normalized server, or undefined when the shape is unusable.
 */
function normalizeServer(name, value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value
  const url = typeof record.url === 'string' ? record.url : undefined
  const command = typeof record.command === 'string' ? record.command : undefined
  if (url === undefined && command === undefined) return undefined
  const args = Array.isArray(record.args) ? record.args.filter(item => typeof item === 'string') : []
  const env = plainStringMap(record.env)
  const headers = plainStringMap(record.headers)
  const declaredType = typeof record.type === 'string' ? record.type : undefined
  const transport = url !== undefined && declaredType !== 'stdio' ? 'streamable-http' : 'stdio'
  return {
    suggestedId: `mcp-${slug(name)}`,
    serverName: slug(name),
    transport,
    command,
    args,
    env,
    url,
    headers,
    originalName: name,
  }
}

/** Keep only string-valued pairs. */
function plainStringMap(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') out[key] = item
  }
  return out
}

/** Make a name safe for `serverName` and for a loader row id. */
function slug(name) {
  const cleaned = String(name).replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const trimmed = cleaned.slice(0, 32)
  return trimmed === '' ? `server-${Date.now().toString(36).slice(-4)}` : trimmed
}
