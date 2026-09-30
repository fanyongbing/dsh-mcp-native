/**
 * Browser-half contract test — no DSH checkout, no browser, no dependencies.
 *
 * The client bundle is a `window.__ModuleLoader__.load({ id, factory })`
 * registration. This test plays the host's module loader, runs the plugin
 * factory, executes `apply` against a recording client context, and asserts the
 * Settings contribution the whole plugin rests on: exactly one
 * `settings.section` entry, under the package's own id, with a localized label
 * thunk and both dictionaries registered.
 */

// ---------------------------------------------------------------------------
// The module table the host hands the factory
// ---------------------------------------------------------------------------
const react = {
  createElement: () => null,
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}

const requireShim = (specifier) => {
  if (specifier === 'react') return react
  if (specifier === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return {}
  throw new Error(`client.test: unexpected require(${JSON.stringify(specifier)})`)
}

let captured = null
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition
      return definition
    },
  },
}

// ---------------------------------------------------------------------------
// A recording client context
// ---------------------------------------------------------------------------
const dictionaries = new Map()
const registrations = []
const effects = []

const t = (key, params) => {
  const entry = dictionaries.get('zh') ?? dictionaries.get('en')
  const dict = entry === undefined ? {} : entry.dict
  const template = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

const ctx = {
  effect(body, label) {
    effects.push(label)
    const dispose = body()
    return { dispose: () => { if (typeof dispose === 'function') dispose() } }
  },
  locale: {
    register(ns, locale, dict) {
      dictionaries.set(locale, { ns, dict })
      return () => {}
    },
    bind() { return t },
  },
  slots: {
    inject(key, callback) {
      effects.push(`slots.inject(${key})`)
      const dispose = callback()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const results = []
const check = (name, condition, detail) => results.push({ name, pass: Boolean(condition), detail })

const bundle = await import(new URL('../lib/client.js', import.meta.url).href)

check('bundle calls __ModuleLoader__.load', captured !== null)
check('bundle registers under the package name', captured?.id === 'dsh-mcp-native', captured?.id)
check('bundle exposes a factory', typeof captured?.factory === 'function')

const plugin = captured.factory(requireShim)
check('exports apply()', typeof plugin.apply === 'function')
check('exports a service inject list', Array.isArray(plugin.inject), JSON.stringify(plugin.inject))
check('requires the slots and locale services',
  plugin.inject.includes('slots') && plugin.inject.includes('locale'), JSON.stringify(plugin.inject))
check('has no default export (the loader would take it as the plugin)',
  plugin.default === undefined, String(plugin.default))

plugin.apply(ctx)

check('registers both dictionaries', dictionaries.has('zh') && dictionaries.has('en'),
  [...dictionaries.keys()].join(','))
check('dictionaries own their namespace',
  dictionaries.get('zh').ns === 'mcp-native' && dictionaries.get('en').ns === 'mcp-native')
check('zh and en have the same key set',
  JSON.stringify(Object.keys(dictionaries.get('zh').dict).sort())
  === JSON.stringify(Object.keys(dictionaries.get('en').dict).sort()))
check('every zh string is non-empty',
  Object.values(dictionaries.get('zh').dict).every(v => typeof v === 'string' && v !== ''))

check('waits for the settings.section declaration', effects.some(e => e === 'slots.inject(settings.section)'),
  effects.join(' | '))
check('contributes exactly one settings section', registrations.length === 1, `got ${registrations.length}`)

const registration = registrations[0]
if (registration !== undefined) {
  const options = registration.options
  check('registers into settings.section', options.name === 'settings.section', options.name)
  check('uses a section id of its own', options.id === 'mcp', options.id)
  check('ships a numeric order', Number.isFinite(options.order), String(options.order))
  check('label is a thunk (re-read on every projection)', typeof options.label === 'function')
  check('label resolves through the dictionary', options.label() === 'MCP 服务', options.label())
  check('declares its locale namespace', options.locale === 'mcp-native', options.locale)
  check('injects a translate function', typeof options.inject === 'function'
    && typeof options.inject().t === 'function')
  check('component is a function', typeof registration.component === 'function')
}

const failed = results.filter(row => !row.pass)
for (const row of results) {
  console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${row.name}${row.pass ? '' : `  -> ${row.detail}`}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
