/**
 * dsh-mcp-native — browser half.
 *
 * Registers one entry in the Settings navigation (`settings.section`) whose page
 * is a card list of every MCP server configured on this machine, with search,
 * start/stop/restart, a per-server "MCP 说明" panel, a full config editor and
 * an importer for the MCP configs other clients keep on this machine.
 *
 * Hand-bundled in the host's `window.__ModuleLoader__` format: the shell serves
 * this file at /plugins/<id>/client.js and hands the factory a `require` bound
 * to the shared module table (react, react-dom, the static UI primitives).
 * @module dsh-mcp-native/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-mcp-native',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const P = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const NS = 'mcp-native'

    // -----------------------------------------------------------------------
    // Copy
    // -----------------------------------------------------------------------

    const ZH = {
      nav: 'MCP 服务',
      title: 'MCP 服务',
      subtitle: '管理本机 MCP 服务器的连接、说明与配置',
      search: '搜索名称、命令、地址或说明…',
      filterAll: '全部',
      filterRunning: '运行中',
      filterStopped: '已停用',
      filterFailed: '异常',
      refresh: '刷新',
      refreshing: '刷新中…',
      add: '新增服务器',
      import: '从本机导入',
      help: '字段说明',
      countTotal: '共 {n} 个服务器',
      countDetail: '运行中 {running} · 已停用 {stopped} · 异常 {failed} · 工具 {tools} 个',
      empty: '还没有配置任何 MCP 服务器',
      emptyHint: '点击「新增服务器」，或从 Claude Desktop / Cursor 等客户端导入已有配置。',
      noMatch: '没有匹配的服务器',
      stateRunning: '运行中',
      stateStopped: '已停用',
      stateStarting: '启动中',
      stateFailed: '异常',
      transportStdio: 'stdio 本地进程',
      transportHttp: 'Streamable HTTP',
      tools: '工具',
      toolsCount: '{n} 个工具',
      noTools: '尚未发现工具',
      cmdLabel: '命令',
      urlLabel: '地址',
      envLabel: '环境变量',
      start: '启动',
      stop: '停用',
      restart: '重启',
      open: '说明与配置',
      remove: '删除',
      removeConfirm: '确定删除 MCP 服务器「{name}」吗？该行会从 profile 中移除。',
      cancel: '取消',
      confirmDelete: '确认删除',
      save: '保存',
      saving: '保存中…',
      close: '关闭',
      tabInfo: '说明',
      tabConfig: '配置',
      tabTools: '工具',
      tabJson: 'JSON',
      sectionBasic: '基本信息',
      sectionStdio: '本地 stdio',
      sectionHttp: '远端 Streamable HTTP',
      sectionAdvanced: '高级',
      sectionReconnect: '重连策略',
      fieldServerName: '服务名称 serverName',
      fieldServerNameHint: '工具名前缀，模型看到的工具是 mcp__<serverName>__<tool>',
      fieldTransport: '传输方式 transport',
      fieldCommand: '命令 command',
      fieldArgs: '参数 args',
      fieldArgsHint: '每行一个参数',
      fieldEnv: '环境变量 env',
      fieldCwd: '工作目录 cwd',
      fieldUrl: '服务地址 url',
      fieldHeaders: '请求头 headers',
      fieldTimeout: '调用超时 toolCallTimeoutMs',
      fieldTimeoutHint: '毫秒，默认 60000',
      fieldMaxInstruction: '说明上限 maxInstructionBytes',
      fieldMaxInstructionHint: '字节，默认 32768',
      fieldFailOnStartup: '启动失败即报错 failOnStartupError',
      fieldFailOnStartupHint: '默认关闭：连接失败只记日志，dsh 照常启动',
      fieldReconnectEnabled: '自动重连',
      fieldReconnectInitial: '首次间隔（毫秒）',
      fieldReconnectMax: '间隔上限（毫秒）',
      fieldReconnectAttempts: '最大次数',
      keyPlaceholder: '名称',
      valuePlaceholder: '值',
      addEntry: '添加一行',
      removeEntry: '删除',
      jsHint: '值可以写成 !!js 表达式读取环境变量，例如 !!js process.env.MY_TOKEN',
      jsonHint: '这里是该行在 profile 中的原始 config；保存后立即生效。',
      jsonSave: '保存 JSON',
      profileFile: '配置文件',
      honesty: '「运行中」表示插件行已挂载，并不等于 MCP 连接成功 —— 若该服务器启动即失败，工具列表会是空的。工具列表是连接成功唯一的直接证据。',
      noDescription: '暂无说明',
      docs: '官方文档',
      saved: '配置已保存，连接已按新配置重新建立',
      started: '已启动',
      stopped: '已停用',
      restarted: '已重启',
      removed: '已删除',
      added: '已新增 MCP 服务器 {name}',
      imported: '已导入 {n} 个服务器',
      importTitle: '从本机导入 MCP 配置',
      importHint: '读取本机其他客户端留下的 MCP 配置文件，勾选后写入当前 profile。',
      importNothing: '没有在本机找到可导入的 MCP 配置',
      importScanning: '正在扫描本机配置…',
      importApply: '导入所选',
      statusMissing: '不存在',
      statusOk: '可导入',
      statusEmpty: '没有服务器',
      statusSkipped: '已跳过',
      statusError: '读取失败',
      helpTitle: 'MCP 配置字段说明',
      helpHint: '这些是 @deepseek-ai/dsh-mcp-client 行接受的全部字段。',
      failPrefix: '操作失败：',
      disabledByProfile: '该行在当前 profile 中不可管理',
      reconnectNote: '重连次数用尽后，该服务器的工具会被移除，只能通过「重启」或重启 dsh 恢复。',
      defaultValue: '默认值：',
      loading: '加载中…',
    }

    const EN = {
      nav: 'MCP Servers',
      title: 'MCP Servers',
      subtitle: 'Manage this machine’s MCP servers: connections, documentation and config',
      search: 'Search name, command, URL or description…',
      filterAll: 'All',
      filterRunning: 'Running',
      filterStopped: 'Stopped',
      filterFailed: 'Failed',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      add: 'Add server',
      import: 'Import from this machine',
      help: 'Field reference',
      countTotal: '{n} servers',
      countDetail: '{running} running · {stopped} stopped · {failed} failed · {tools} tools',
      empty: 'No MCP server is configured yet',
      emptyHint: 'Add one, or import an existing configuration from Claude Desktop / Cursor.',
      noMatch: 'No server matches',
      stateRunning: 'Running',
      stateStopped: 'Stopped',
      stateStarting: 'Starting',
      stateFailed: 'Failed',
      transportStdio: 'stdio process',
      transportHttp: 'Streamable HTTP',
      tools: 'Tools',
      toolsCount: '{n} tools',
      noTools: 'No tool discovered yet',
      cmdLabel: 'Command',
      urlLabel: 'URL',
      envLabel: 'Env',
      start: 'Start',
      stop: 'Stop',
      restart: 'Restart',
      open: 'Documentation & config',
      remove: 'Delete',
      removeConfirm: 'Delete MCP server “{name}”? Its loader row is removed from the profile.',
      cancel: 'Cancel',
      confirmDelete: 'Delete',
      save: 'Save',
      saving: 'Saving…',
      close: 'Close',
      tabInfo: 'About',
      tabConfig: 'Config',
      tabTools: 'Tools',
      tabJson: 'JSON',
      sectionBasic: 'Basics',
      sectionStdio: 'Local stdio',
      sectionHttp: 'Remote Streamable HTTP',
      sectionAdvanced: 'Advanced',
      sectionReconnect: 'Reconnect',
      fieldServerName: 'serverName',
      fieldServerNameHint: 'Tool-name prefix: the model sees mcp__<serverName>__<tool>',
      fieldTransport: 'transport',
      fieldCommand: 'command',
      fieldArgs: 'args',
      fieldArgsHint: 'One argument per line',
      fieldEnv: 'env',
      fieldCwd: 'cwd',
      fieldUrl: 'url',
      fieldHeaders: 'headers',
      fieldTimeout: 'toolCallTimeoutMs',
      fieldTimeoutHint: 'Milliseconds, default 60000',
      fieldMaxInstruction: 'maxInstructionBytes',
      fieldMaxInstructionHint: 'Bytes, default 32768',
      fieldFailOnStartup: 'failOnStartupError',
      fieldFailOnStartupHint: 'Off by default: a failed connect is logged, dsh still boots',
      fieldReconnectEnabled: 'Reconnect automatically',
      fieldReconnectInitial: 'First delay (ms)',
      fieldReconnectMax: 'Delay ceiling (ms)',
      fieldReconnectAttempts: 'Max attempts',
      keyPlaceholder: 'Name',
      valuePlaceholder: 'Value',
      addEntry: 'Add row',
      removeEntry: 'Remove',
      jsHint: 'A value may be a !!js expression, e.g. !!js process.env.MY_TOKEN',
      jsonHint: 'The raw config this row carries in the profile; saving applies it immediately.',
      jsonSave: 'Save JSON',
      profileFile: 'Profile',
      honesty: '“Running” means the loader row is mounted — it is NOT proof the MCP connection succeeded. A server that fails on startup keeps an empty tool list, which is the only direct evidence of a live connection.',
      noDescription: 'No description',
      docs: 'Documentation',
      saved: 'Saved; the connection was rebuilt from the new config',
      started: 'Started',
      stopped: 'Stopped',
      restarted: 'Restarted',
      removed: 'Deleted',
      added: 'Added MCP server {name}',
      imported: 'Imported {n} servers',
      importTitle: 'Import MCP configs from this machine',
      importHint: 'Reads the MCP config files other clients left on this machine; checked servers are written into the current profile.',
      importNothing: 'No importable MCP config found on this machine',
      importScanning: 'Scanning this machine…',
      importApply: 'Import selected',
      statusMissing: 'missing',
      statusOk: 'importable',
      statusEmpty: 'no servers',
      statusSkipped: 'skipped',
      statusError: 'unreadable',
      helpTitle: 'MCP config field reference',
      helpHint: 'Every field the @deepseek-ai/dsh-mcp-client row accepts.',
      failPrefix: 'Failed: ',
      disabledByProfile: 'This row is not manageable in the current profile',
      reconnectNote: 'Once the reconnect budget is exhausted the server’s tools are removed; only Restart (or a dsh restart) brings them back.',
      defaultValue: 'Default: ',
      loading: 'Loading…',
    }

    /** Substitute `{name}` placeholders without pulling in a formatter. */
    function fill(template, params) {
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, key) => (
        Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
      ))
    }

    // -----------------------------------------------------------------------
    // Transport
    // -----------------------------------------------------------------------

    /**
     * POST one verb to the host half. The path is DOCUMENT-RELATIVE (no leading
     * slash): the GUI is served with `<base href="./">`, so a root-absolute path
     * escapes a sub-path deployment and never reaches the host route.
     */
    async function call(verb, payload) {
      let response
      try {
        response = await fetch(`mcp-native/${verb}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload === undefined ? {} : payload),
        })
      } catch (error) {
        const detail = error !== null && error !== undefined && error.message !== undefined ? error.message : error
        throw new Error(`无法连接 dsh host：${String(detail)}`)
      }
      let envelope
      try {
        envelope = await response.json()
      } catch {
        throw new Error('host 返回了非 JSON 响应')
      }
      if (envelope === null || typeof envelope !== 'object' || envelope.ok !== true) {
        const message = envelope !== null && typeof envelope === 'object' && envelope.error !== undefined
          ? envelope.error.message
          : undefined
        throw new Error(typeof message === 'string' ? message : '请求失败')
      }
      return envelope.value
    }

    // -----------------------------------------------------------------------
    // Styles — theme tokens only, so light/dark follow the app
    // -----------------------------------------------------------------------

    const STYLE_ID = 'dsh-mcp-native-style'
    const CSS = [
      '.dsh-mcp{display:flex;flex-direction:column;gap:16px}',
      '.dsh-mcp__head{display:flex;flex-direction:column;gap:4px}',
      '.dsh-mcp__title{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsh-mcp__sub{font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-mcp__counts{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-mcp__toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.dsh-mcp__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}',
      '.dsh-mcp-card{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1)}',
      '.dsh-mcp-card--stopped{opacity:.7}',
      '.dsh-mcp-card__top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dsh-mcp-card__name{font-weight:600;font-size:14px;color:var(--dsw-alias-label-primary)}',
      '.dsh-mcp-card__spacer{flex:1 1 auto}',
      '.dsh-mcp-card__summary{font-size:13px;line-height:1.55;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.dsh-mcp-card__meta{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-mcp-card__meta b{font-weight:500;color:var(--dsw-alias-label-secondary);margin-right:4px}',
      '.dsh-mcp-card__actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:4px}',
      '.dsh-mcp-mono{font-family:var(--ds-font-family-code);overflow-wrap:anywhere}',
      '.dsh-mcp-empty{padding:36px 20px;text-align:center;border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);color:var(--dsw-alias-label-secondary);font-size:13px;display:flex;flex-direction:column;gap:6px}',
      '.dsh-mcp-note{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-mcp-banner{padding:8px 12px;border-radius:var(--dsw-radius-md);font-size:13px;border:1px solid var(--dsw-alias-border-l1)}',
      '.dsh-mcp-banner--ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}',
      '.dsh-mcp-banner--err{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      // Modal geometry: `<Modal>` has no size prop, so the consumer supplies it.
      // The card is capped at the layer's padding box and the content column
      // scrolls inside it, instead of the card growing taller than the viewport.
      '.dsh-mcp-modal{width:min(920px,100%);max-height:100%}',
      '.dsh-mcp-modal__scroll{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}',
      // `<Modal>` already pads the body column (24px); these wrappers add none.
      '.dsh-mcp-form{display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.dsh-mcp-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start}',
      '.dsh-mcp-group{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);min-width:0}',
      '.dsh-mcp-group__title{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-mcp-field{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dsh-mcp-field__label{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-mcp-field__hint{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.5}',
      '.dsh-mcp-textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;padding:8px 10px;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);outline:none}',
      '.dsh-mcp-textarea:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dsh-mcp-switchrow{display:flex;align-items:center;gap:8px}',
      '.dsh-mcp-kv{display:flex;flex-direction:column;gap:6px}',
      // `<Input>` renders `<span class="…wrap"><input></span>` with no width of
      // its own: it only fills a COLUMN flex container (children stretch on the
      // cross axis). Inside a row these slots must be flex containers too, or
      // the field collapses to the browser's intrinsic input width.
      '.dsh-mcp-kv__row{display:flex;gap:8px;align-items:center;min-width:0}',
      '.dsh-mcp-kv__key{flex:0 0 38%;min-width:104px;display:flex;min-width:0}',
      '.dsh-mcp-kv__val{flex:1 1 auto;display:flex;min-width:0}',
      '.dsh-mcp-kv__key>*,.dsh-mcp-kv__val>*{flex:1 1 auto;min-width:0}',
      '.dsh-mcp-kv__remove{align-self:stretch;display:flex;align-items:center}',
      // Match whatever the Input control actually renders as (its 0.5px border
      // makes it taller than the nominal 32px), instead of hard-coding a height.
      '.dsh-mcp-kv__remove>*{height:100%}',
      '.dsh-mcp-kv__add{align-self:flex-start}',
      // The search box sits directly in the toolbar row, so it needs the same
      // treatment: make the slot a flex container that stretches its Input.
      '.dsh-mcp__search{flex:1 1 220px;min-width:180px;display:flex}',
      '.dsh-mcp__search>*{flex:1 1 auto;min-width:0}',
      // Facts: the label column shrinks to its text, the value column takes the
      // rest and wraps on word boundaries rather than mid-token.
      '.dsh-mcp-facts{display:grid;grid-template-columns:minmax(96px,max-content) minmax(0,1fr);gap:8px 18px;font-size:13px;margin:0;align-items:start}',
      '.dsh-mcp-facts dt{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.7}',
      '.dsh-mcp-facts dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;line-height:1.7}',
      '.dsh-mcp-chips{display:flex;flex-wrap:wrap;gap:4px}',
      '.dsh-mcp-chip{font-family:var(--ds-font-family-code);font-size:11px;line-height:1.5;padding:1px 6px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}',
      '.dsh-mcp-tools{display:flex;flex-direction:column;gap:8px}',
      '.dsh-mcp-tool{padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dsh-mcp-tool__name{font-family:var(--ds-font-family-code);font-size:12px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
      '.dsh-mcp-tool__desc{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}',
      '.dsh-mcp-import{display:flex;flex-direction:column;gap:12px;min-width:0}',
      '.dsh-mcp-import__src{display:flex;flex-direction:column;gap:4px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);min-width:0}',
      '.dsh-mcp-import__row{display:flex;gap:8px;align-items:center;min-width:0}',
      '.dsh-mcp-import__row .dsh-mcp-tool__desc{flex:1 1 auto;min-width:0}',
      '.dsh-mcp-links{font-size:13px}',
      '.dsh-mcp-links a{color:var(--dsw-alias-link)}',
    ].join('\n')

    /** Inject the stylesheet once per document. */
    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.getElementById(STYLE_ID) !== null) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    // -----------------------------------------------------------------------
    // Small helpers
    // -----------------------------------------------------------------------

    /** Join class names, dropping falsy parts. */
    function cx() {
      const parts = []
      for (let index = 0; index < arguments.length; index += 1) {
        if (arguments[index]) parts.push(arguments[index])
      }
      return parts.join(' ')
    }

    /** Build the `value`/`onChange` pair for one controlled draft field. */
    function bind(draft, setDraft) {
      return (key) => ({
        value: draft[key] === undefined || draft[key] === null ? '' : String(draft[key]),
        onChange: (event) => setDraft(Object.assign({}, draft, { [key]: event.target.value })),
      })
    }

    // -----------------------------------------------------------------------
    // Presentational pieces
    // -----------------------------------------------------------------------

    /** Localized label, dot state and tag tone for one lifecycle state. */
    function stateView(t, state) {
      if (state === 'running') return { label: t('stateRunning'), dot: 'done', tone: 'success' }
      if (state === 'stopped') return { label: t('stateStopped'), dot: 'idle', tone: 'neutral' }
      if (state === 'failed') return { label: t('stateFailed'), dot: 'error', tone: 'danger' }
      return { label: t('stateStarting'), dot: 'ongoing', tone: 'warning' }
    }

    /** One labelled form field. */
    function Field(props) {
      const children = [h('label', { className: 'dsh-mcp-field__label', key: 'label' }, props.label)]
      if (props.children !== undefined && props.children !== null) children.push(props.children)
      if (props.hint !== undefined) children.push(h('span', { className: 'dsh-mcp-field__hint', key: 'hint' }, props.hint))
      return h('div', { className: 'dsh-mcp-field' }, children)
    }

    /**
     * A two-column definition list. A row renders `node` when it carries one
     * (chips, links) and its plain `value` otherwise; blank rows are skipped.
     */
    function Facts(props) {
      const rows = props.rows.filter(row => row.node !== undefined
        || (row.value !== undefined && row.value !== null && row.value !== ''))
      if (rows.length === 0) return null
      const children = []
      rows.forEach((row, index) => {
        children.push(h('dt', { key: `t${index}` }, row.label))
        children.push(h('dd', {
          key: `d${index}`,
          className: row.mono === true ? 'dsh-mcp-mono' : undefined,
        }, row.node !== undefined ? row.node : String(row.value)))
      })
      return h('dl', { className: 'dsh-mcp-facts' }, children)
    }

    /** Env / header names as chips — a comma string wraps mid-token in a narrow column. */
    function KeyChips(props) {
      const keys = props.keys === undefined ? [] : props.keys
      if (keys.length === 0) return undefined
      return h('span', { className: 'dsh-mcp-chips' }, keys.map(key => h('span', { className: 'dsh-mcp-chip', key }, key)))
    }

    /** Editable env/headers map, one row per pair. */
    function KeyValueEditor(props) {
      const t = props.t
      const rows = props.rows.length === 0 ? [{ key: '', value: '' }] : props.rows
      const update = (index, side, value) => {
        const next = rows.map((row, position) => (
          position === index ? { key: side === 'key' ? value : row.key, value: side === 'value' ? value : row.value } : row
        ))
        props.onChange(next)
      }
      const children = [h('span', { className: 'dsh-mcp-field__label', key: 'label' }, props.label)]
      children.push(h('div', { className: 'dsh-mcp-kv', key: 'rows' }, rows.map((row, index) => h('div', {
        className: 'dsh-mcp-kv__row',
        key: index,
      },
        h('div', { className: 'dsh-mcp-kv__key' }, h(P.Input, {
          placeholder: t('keyPlaceholder'),
          value: row.key,
          onChange: (event) => update(index, 'key', event.target.value),
        })),
        h('div', { className: 'dsh-mcp-kv__val' }, h(P.Input, {
          placeholder: t('valuePlaceholder'),
          value: row.value,
          onChange: (event) => update(index, 'value', event.target.value),
        })),
        h('span', { className: 'dsh-mcp-kv__remove' }, h(P.Button, {
          size: 'sm',
          variant: 'ghost',
          title: t('removeEntry'),
          'aria-label': t('removeEntry'),
          // Square icon button that stretches to the Input control's height.
          style: { width: 32, padding: 0 },
          onClick: () => props.onChange(rows.filter((_, position) => position !== index)),
        }, h(P.IconCloseOutlineRegular, { size: 14 })))))))
      children.push(h(P.Button, {
        key: 'add',
        className: 'dsh-mcp-kv__add',
        size: 'sm',
        variant: 'ghost',
        icon: h(P.IconPlusOutlineRegular, { size: 14 }),
        onClick: () => props.onChange(rows.concat([{ key: '', value: '' }])),
      }, t('addEntry')))
      if (props.hint !== undefined) children.push(h('span', { className: 'dsh-mcp-field__hint', key: 'hint' }, props.hint))
      return h('div', { className: 'dsh-mcp-field' }, children)
    }

    /** One MCP server card. */
    function ServerCard(props) {
      const t = props.t
      const server = props.server
      const view = stateView(t, server.state)
      const launch = server.transport === 'stdio'
        ? [server.command].concat(server.args === undefined ? [] : server.args).filter(Boolean).join(' ')
        : (server.url === undefined ? '' : server.url)
      const top = [
        h(P.StateDot, { state: view.dot, size: 10, key: 'dot' }),
        h('span', { className: 'dsh-mcp-card__name', key: 'name' }, server.serverName),
        h(P.Tag, { tone: view.tone, key: 'state' }, view.label),
        h('span', { className: 'dsh-mcp-card__spacer', key: 'spacer' }),
        h(P.Tag, { tone: 'outline', key: 'transport' }, server.transport === 'stdio' ? t('transportStdio') : t('transportHttp')),
      ]
      const meta = []
      if (launch !== '') {
        meta.push(h('span', { key: 'launch' },
          h('b', {}, server.transport === 'stdio' ? t('cmdLabel') : t('urlLabel')),
          h('span', { className: 'dsh-mcp-mono' }, launch)))
      }
      meta.push(h('span', { key: 'tools' },
        h('b', {}, t('tools')),
        server.toolCount > 0 ? fill(t('toolsCount'), { n: server.toolCount }) : t('noTools')))
      if (server.envKeys !== undefined && server.envKeys.length > 0) {
        meta.push(h('span', { key: 'env' }, h('b', {}, t('envLabel')), server.envKeys.join(', ')))
      }
      if (server.error !== undefined) {
        meta.push(h('span', { key: 'error' }, h('b', {}, 'error'), server.error))
      }
      const disabled = props.busy === true || server.readOnlyReason !== undefined
      const actions = [
        h(P.Button, {
          key: 'toggle',
          size: 'sm',
          variant: server.state === 'stopped' ? 'primary' : 'outline',
          disabled,
          title: server.readOnlyReason === undefined ? undefined : t('disabledByProfile'),
          icon: server.state === 'stopped' ? h(P.IconPlayOutlineRegular, { size: 14 }) : h(P.IconPauseOutlineRegular, { size: 14 }),
          onClick: () => props.onToggle(server, server.state === 'stopped'),
        }, server.state === 'stopped' ? t('start') : t('stop')),
        h(P.Button, {
          key: 'restart',
          size: 'sm',
          variant: 'ghost',
          disabled,
          icon: h(P.IconRefreshOutlineRegular, { size: 14 }),
          onClick: () => props.onRestart(server),
        }, t('restart')),
        h(P.Button, {
          key: 'open',
          size: 'sm',
          variant: 'ghost',
          icon: h(P.IconInfoOutlineRegular, { size: 14 }),
          onClick: () => props.onOpen(server),
        }, t('open')),
        h(P.Button, {
          key: 'remove',
          size: 'sm',
          variant: 'ghost',
          disabled: props.busy === true,
          icon: h(P.IconTrashOutlineRegular, { size: 14 }),
          onClick: () => props.onDelete(server),
        }, t('remove')),
      ]
      return h('div', { className: cx('dsh-mcp-card', server.state === 'stopped' && 'dsh-mcp-card--stopped') },
        h('div', { className: 'dsh-mcp-card__top' }, top),
        h('div', { className: 'dsh-mcp-card__summary' }, (server.description && server.description.summary) || t('noDescription')),
        h('div', { className: 'dsh-mcp-card__meta' }, meta),
        h('div', { className: 'dsh-mcp-card__actions' }, actions))
    }

    /** The "MCP 说明" tab: what this server is, plus every effective setting. */
    function InfoTab(props) {
      const t = props.t
      const detail = props.detail
      const description = detail.description === undefined ? {} : detail.description
      const facts = [
        { label: t('fieldServerName'), value: detail.serverName, mono: true },
        { label: t('fieldTransport'), value: detail.transport === 'stdio' ? t('transportStdio') : t('transportHttp') },
        { label: 'loader id', value: detail.id, mono: true },
      ]
      if (detail.transport === 'stdio') {
        facts.push({ label: t('fieldCommand'), value: detail.command, mono: true })
        facts.push({ label: t('fieldArgs'), value: (detail.args === undefined ? [] : detail.args).join(' '), mono: true })
        facts.push({ label: t('fieldCwd'), value: detail.cwd, mono: true })
        facts.push({ label: t('fieldEnv'), node: h(KeyChips, { keys: detail.envKeys }) })
      } else {
        facts.push({ label: t('fieldUrl'), value: detail.url, mono: true })
        facts.push({ label: t('fieldHeaders'), node: h(KeyChips, { keys: detail.headerKeys }) })
      }
      facts.push({ label: t('fieldTimeout'), value: detail.toolCallTimeoutMs })
      facts.push({ label: t('fieldFailOnStartup'), value: detail.failOnStartupError === true ? 'true' : 'false' })
      facts.push({ label: t('fieldReconnectEnabled'), value: detail.reconnectEnabled === false ? 'false' : 'true' })
      facts.push({ label: t('fieldReconnectAttempts'), value: detail.reconnectMaxAttempts })

      const children = [
        h('div', { key: 'about' },
          h('div', { className: 'dsh-mcp-card__name' }, description.title === undefined ? detail.serverName : description.title),
          h('div', { className: 'dsh-mcp-card__summary' }, description.summary === undefined ? t('noDescription') : description.summary),
          description.detail === undefined ? null : h('div', { className: 'dsh-mcp-note' }, description.detail)),
      ]
      if (description.docs !== undefined) {
        children.push(h('div', { className: 'dsh-mcp-links', key: 'docs' },
          h('a', { href: description.docs, target: '_blank', rel: 'noreferrer noopener' }, t('docs'))))
      }
      children.push(h(Facts, { rows: facts, key: 'facts' }))
      children.push(h('div', { className: 'dsh-mcp-note', key: 'honesty' }, t('honesty')))
      children.push(h('div', { className: 'dsh-mcp-note', key: 'reconnect' }, t('reconnectNote')))
      return h('div', { className: 'dsh-mcp-form' }, children)
    }

    /** The Tools tab: every tool this server registered, with its description. */
    function ToolsTab(props) {
      const t = props.t
      const tools = props.detail.tools === undefined ? [] : props.detail.tools
      if (tools.length === 0) {
        return h('div', { className: 'dsh-mcp-empty' },
          h('span', {}, t('noTools')),
          h('span', { className: 'dsh-mcp-note' }, t('honesty')))
      }
      return h('div', { className: 'dsh-mcp-tools' }, tools.map(tool => h('div', { className: 'dsh-mcp-tool', key: tool.name },
        h('span', { className: 'dsh-mcp-tool__name' }, tool.name),
        h('span', { className: 'dsh-mcp-tool__desc' }, tool.description === '' ? t('noDescription') : tool.description))))
    }

    /** The Config tab: the whole form over one draft object. */
    function ConfigTab(props) {
      const t = props.t
      const draft = props.draft
      const setDraft = props.setDraft
      const field = bind(draft, setDraft)
      const isStdio = draft.transport !== 'streamable-http'
      const groups = []

      groups.push(h('div', { className: 'dsh-mcp-group', key: 'basic' },
        h('span', { className: 'dsh-mcp-group__title' }, t('sectionBasic')),
        h(Field, { label: t('fieldServerName'), hint: t('fieldServerNameHint') },
          h(P.Input, Object.assign({}, field('serverName'), { style: { width: '100%' } }))),
        h(Field, { label: t('fieldTransport') },
          h(P.SegmentedControl, {
            id: 'dsh-mcp-transport',
            label: t('fieldTransport'),
            value: draft.transport,
            options: [
              { value: 'stdio', label: t('transportStdio') },
              { value: 'streamable-http', label: t('transportHttp') },
            ],
            onChange: (value) => setDraft(Object.assign({}, draft, { transport: value })),
          }))))

      if (isStdio) {
        groups.push(h('div', { className: 'dsh-mcp-group', key: 'stdio' },
          h('span', { className: 'dsh-mcp-group__title' }, t('sectionStdio')),
          h(Field, { label: t('fieldCommand') },
            h(P.Input, Object.assign({}, field('command'), { style: { width: '100%' } }))),
          h(Field, { label: t('fieldArgs'), hint: t('fieldArgsHint') },
            h('textarea', Object.assign({ className: 'dsh-mcp-textarea' }, field('argsText')))),
          h(KeyValueEditor, {
            t,
            label: t('fieldEnv'),
            hint: t('jsHint'),
            rows: draft.env,
            onChange: (rows) => setDraft(Object.assign({}, draft, { env: rows })),
          }),
          h(Field, { label: t('fieldCwd') },
            h(P.Input, Object.assign({}, field('cwd'), { style: { width: '100%' } })))))
      } else {
        groups.push(h('div', { className: 'dsh-mcp-group', key: 'http' },
          h('span', { className: 'dsh-mcp-group__title' }, t('sectionHttp')),
          h(Field, { label: t('fieldUrl') },
            h(P.Input, Object.assign({}, field('url'), { style: { width: '100%' } }))),
          h(KeyValueEditor, {
            t,
            label: t('fieldHeaders'),
            hint: t('jsHint'),
            rows: draft.headers,
            onChange: (rows) => setDraft(Object.assign({}, draft, { headers: rows })),
          })))
      }

      groups.push(h('div', { className: 'dsh-mcp-group', key: 'advanced' },
        h('span', { className: 'dsh-mcp-group__title' }, t('sectionAdvanced')),
        h(Field, { label: t('fieldTimeout'), hint: t('fieldTimeoutHint') },
          h(P.Input, Object.assign({}, field('toolCallTimeoutMs'), { inputMode: 'numeric', style: { width: '100%' } }))),
        h(Field, { label: t('fieldMaxInstruction'), hint: t('fieldMaxInstructionHint') },
          h(P.Input, Object.assign({}, field('maxInstructionBytes'), { inputMode: 'numeric', style: { width: '100%' } }))),
        h('div', { className: 'dsh-mcp-switchrow' },
          h(P.Switch, {
            checked: draft.failOnStartupError === true,
            label: t('fieldFailOnStartup'),
            onChange: (checked) => setDraft(Object.assign({}, draft, { failOnStartupError: checked })),
          }),
          h('span', { className: 'dsh-mcp-field__hint' }, t('fieldFailOnStartupHint')))))

      groups.push(h('div', { className: 'dsh-mcp-group', key: 'reconnect' },
        h('span', { className: 'dsh-mcp-group__title' }, t('sectionReconnect')),
        h('div', { className: 'dsh-mcp-switchrow' },
          h(P.Switch, {
            checked: draft.reconnectEnabled !== false,
            label: t('fieldReconnectEnabled'),
            onChange: (checked) => setDraft(Object.assign({}, draft, { reconnectEnabled: checked })),
          })),
        h(Field, { label: t('fieldReconnectInitial') },
          h(P.Input, Object.assign({}, field('reconnectInitialDelayMs'), { inputMode: 'numeric', style: { width: '100%' } }))),
        h(Field, { label: t('fieldReconnectMax') },
          h(P.Input, Object.assign({}, field('reconnectMaxDelayMs'), { inputMode: 'numeric', style: { width: '100%' } }))),
        h(Field, { label: t('fieldReconnectAttempts') },
          h(P.Input, Object.assign({}, field('reconnectMaxAttempts'), { inputMode: 'numeric', style: { width: '100%' } }))),
        h('span', { className: 'dsh-mcp-field__hint' }, t('reconnectNote'))))

      return h('div', { className: 'dsh-mcp-form' },
        h('div', { className: 'dsh-mcp-columns' }, groups))
    }

    /** The JSON tab: the raw profile config, hand-editable. */
    function JsonTab(props) {
      return h('div', { className: 'dsh-mcp-form' },
        h('span', { className: 'dsh-mcp-field__hint' }, props.t('jsonHint')),
        h('textarea', {
          className: 'dsh-mcp-textarea',
          style: { minHeight: '260px' },
          spellCheck: false,
          value: props.rawText,
          onChange: (event) => props.setRawText(event.target.value),
        }))
    }

    /** The field reference: every accepted key with its default and meaning. */
    function HelpBody(props) {
      const t = props.t
      const fields = props.fields === undefined ? [] : props.fields
      const children = [h('span', { className: 'dsh-mcp-field__hint', key: 'hint' }, t('helpHint'))]
      fields.forEach((field) => {
        const rows = [
          h('span', { className: 'dsh-mcp-tool__name', key: 'name' }, field.label),
          h('span', { className: 'dsh-mcp-tool__desc', key: 'summary' }, field.summary),
          h('span', { className: 'dsh-mcp-field__hint', key: 'detail' }, field.detail),
        ]
        if (field.default !== undefined) {
          rows.push(h('span', { className: 'dsh-mcp-field__hint', key: 'default' }, `${t('defaultValue')}${field.default}`))
        }
        children.push(h('div', { className: 'dsh-mcp-tool', key: field.key }, rows))
      })
      return h('div', { className: 'dsh-mcp-form' }, children)
    }

    // -----------------------------------------------------------------------
    // Draft <-> payload
    // -----------------------------------------------------------------------

    /** Blank draft for the "add server" dialog. */
    function emptyDraft() {
      return {
        serverName: '',
        transport: 'stdio',
        command: 'npx',
        argsText: '-y\n@modelcontextprotocol/server-everything',
        env: [],
        cwd: '',
        url: '',
        headers: [],
        toolCallTimeoutMs: '60000',
        maxInstructionBytes: '',
        failOnStartupError: false,
        reconnectEnabled: true,
        reconnectInitialDelayMs: '',
        reconnectMaxDelayMs: '',
        reconnectMaxAttempts: '',
      }
    }

    /** Draft from one server record returned by the host. */
    function draftFromServer(server) {
      const config = server !== null && server !== undefined && server.config !== undefined ? server.config : {}
      const draft = emptyDraft()
      draft.serverName = server !== null && server.serverName !== undefined ? server.serverName : ''
      draft.transport = server !== null && server.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
      draft.command = typeof config.command === 'string' ? config.command : ''
      draft.argsText = Array.isArray(config.args) ? config.args.join('\n') : ''
      draft.cwd = typeof config.cwd === 'string' ? config.cwd : ''
      draft.url = typeof config.url === 'string' ? config.url : ''
      draft.env = pairsFromMap(config.env)
      draft.headers = pairsFromMap(config.headers)
      draft.toolCallTimeoutMs = config.toolCallTimeoutMs === undefined ? '' : String(config.toolCallTimeoutMs)
      draft.maxInstructionBytes = config.maxInstructionBytes === undefined ? '' : String(config.maxInstructionBytes)
      draft.failOnStartupError = config.failOnStartupError === true
      const reconnect = config.reconnect === undefined ? {} : config.reconnect
      draft.reconnectEnabled = reconnect.enabled !== false
      draft.reconnectInitialDelayMs = reconnect.initialDelayMs === undefined ? '' : String(reconnect.initialDelayMs)
      draft.reconnectMaxDelayMs = reconnect.maxDelayMs === undefined ? '' : String(reconnect.maxDelayMs)
      draft.reconnectMaxAttempts = reconnect.maxAttempts === undefined ? '' : String(reconnect.maxAttempts)
      return draft
    }

    /** Object → editable row list. */
    function pairsFromMap(map) {
      if (map === null || typeof map !== 'object') return []
      return Object.entries(map).map(([key, value]) => ({ key, value: typeof value === 'string' ? value : '' }))
    }

    /** Editable row list → object, dropping blank names. */
    function mapFromPairs(rows) {
      const out = {}
      const list = rows === undefined ? [] : rows
      for (const row of list) {
        const key = String(row.key === undefined ? '' : row.key).trim()
        if (key === '') continue
        out[key] = row.value === undefined ? '' : row.value
      }
      return out
    }

    /** Draft → the host half's editor payload. */
    function payloadFromDraft(draft) {
      return {
        serverName: draft.serverName,
        transport: draft.transport,
        command: draft.command,
        args: String(draft.argsText === undefined ? '' : draft.argsText).split('\n').map(line => line.trim()).filter(line => line !== ''),
        env: mapFromPairs(draft.env),
        cwd: draft.cwd,
        url: draft.url,
        headers: mapFromPairs(draft.headers),
        toolCallTimeoutMs: draft.toolCallTimeoutMs,
        maxInstructionBytes: draft.maxInstructionBytes,
        failOnStartupError: draft.failOnStartupError === true,
        reconnect: {
          enabled: draft.reconnectEnabled !== false,
          initialDelayMs: draft.reconnectInitialDelayMs,
          maxDelayMs: draft.reconnectMaxDelayMs,
          maxAttempts: draft.reconnectMaxAttempts,
        },
      }
    }

    // -----------------------------------------------------------------------
    // Dialogs
    // -----------------------------------------------------------------------

    /** Detail + editor for one existing server. */
    function DetailModal(props) {
      const t = props.t
      const detail = props.detail
      const open = detail !== null
      const openState = React.useState('info')
      const activeTab = openState[0]
      const setActiveTab = openState[1]
      const draftState = React.useState(null)
      const draft = draftState[0]
      const setDraft = draftState[1]
      const rawState = React.useState('')
      const rawText = rawState[0]
      const setRawText = rawState[1]

      React.useEffect(() => {
        if (detail === null) return
        setActiveTab('info')
        setDraft(draftFromServer(detail))
        setRawText(detail.raw === undefined ? '' : detail.raw)
      }, [detail])

      const tabs = [
        { value: 'info', label: t('tabInfo'), id: 'dsh-mcp-tab-info', panelId: 'dsh-mcp-panel-info' },
        { value: 'config', label: t('tabConfig'), id: 'dsh-mcp-tab-config', panelId: 'dsh-mcp-panel-config' },
        { value: 'tools', label: t('tabTools'), id: 'dsh-mcp-tab-tools', panelId: 'dsh-mcp-panel-tools' },
        { value: 'json', label: t('tabJson'), id: 'dsh-mcp-tab-json', panelId: 'dsh-mcp-panel-json' },
      ]

      let panel = null
      if (detail !== null) {
        if (activeTab === 'info') panel = h(InfoTab, { t, detail })
        else if (activeTab === 'config' && draft !== null) panel = h(ConfigTab, { t, draft, setDraft })
        else if (activeTab === 'tools') panel = h(ToolsTab, { t, detail })
        else if (activeTab === 'json') panel = h(JsonTab, { t, rawText, setRawText })
      }

      const footer = h('div', { className: 'dsh-mcp__toolbar' },
        h(P.Button, { size: 'sm', variant: 'ghost', onClick: props.onClose }, t('cancel')),
        h(P.Button, {
          size: 'sm',
          variant: 'primary',
          disabled: props.saving,
          onClick: props.onSave,
        }, props.saving ? t('saving') : (activeTab === 'json' ? t('jsonSave') : t('save'))))

      const body = detail === null ? null : h('div', { className: 'dsh-mcp-form' },
        h(P.SegmentedTabs, { items: tabs, value: activeTab, onChange: setActiveTab, label: t('title') }),
        h('div', { id: `dsh-mcp-panel-${activeTab}`, role: 'tabpanel' }, panel))

      return h(P.Modal, {
        open,
        onClose: props.onClose,
        title: detail === null ? '' : `${detail.serverName} · ${detail.id}`,
        closeLabel: t('close'),
        className: 'dsh-mcp-modal',
        contentClassName: 'dsh-mcp-modal__scroll',
        footer,
      }, body)
    }

    /** The "add server" dialog. */
    function AddModal(props) {
      const t = props.t
      const draftState = React.useState(null)
      const draft = draftState[0]
      const setDraft = draftState[1]
      React.useEffect(() => {
        if (props.open) setDraft(emptyDraft())
      }, [props.open])
      const footer = h('div', { className: 'dsh-mcp__toolbar' },
        h(P.Button, { size: 'sm', variant: 'ghost', onClick: props.onClose }, t('cancel')),
        h(P.Button, { size: 'sm', variant: 'primary', disabled: props.saving, onClick: props.onSubmit },
          props.saving ? t('saving') : t('save')))
      const body = draft === null ? null : h(ConfigTab, { t, draft, setDraft })
      return h(P.Modal, {
        open: props.open,
        onClose: props.onClose,
        title: t('add'),
        closeLabel: t('close'),
        className: 'dsh-mcp-modal',
        contentClassName: 'dsh-mcp-modal__scroll',
        footer,
      }, body)
    }

    /** The "import from this machine" dialog. */
    function ImportModal(props) {
      const t = props.t
      const imports = props.imports
      const picked = props.picked
      const children = [h('span', { className: 'dsh-mcp-field__hint', key: 'hint' }, t('importHint'))]

      if (imports === null) {
        children.push(h('div', { className: 'dsh-mcp-empty', key: 'scan' }, h('span', {}, t('importScanning'))))
      } else {
        const sources = imports.sources === undefined ? [] : imports.sources
        children.push(h('div', { key: 'sources' }, sources.map(source => {
          const tone = source.status === 'ok' ? 'success' : 'neutral'
          const label = source.status === 'ok' ? t('statusOk')
            : source.status === 'missing' ? t('statusMissing')
              : source.status === 'empty' ? t('statusEmpty')
                : source.status === 'skipped' ? t('statusSkipped') : t('statusError')
          const rows = [
            h('div', { className: 'dsh-mcp-import__row', key: 'head' },
              h('span', { className: 'dsh-mcp-card__name' }, source.label),
              h(P.Tag, { tone }, label)),
            h('span', { className: 'dsh-mcp-field__hint dsh-mcp-mono', key: 'path' }, source.path),
          ]
          if (source.error !== undefined) {
            rows.push(h('span', { className: 'dsh-mcp-field__hint', key: 'error' }, source.error))
          }
          return h('div', { className: 'dsh-mcp-import__src', key: source.id }, rows)
        })))

        const servers = imports.servers === undefined ? [] : imports.servers
        if (servers.length === 0) {
          children.push(h('div', { className: 'dsh-mcp-note', key: 'none' }, t('importNothing')))
        } else {
          children.push(h('div', { className: 'dsh-mcp-tools', key: 'servers' }, servers.map(server => {
            const key = `${server.sourceId}:${server.serverName}`
            const summary = server.transport === 'streamable-http'
              ? `streamable-http · ${server.url === undefined ? '' : server.url}`
              : `stdio · ${[server.command].concat(server.args === undefined ? [] : server.args).filter(Boolean).join(' ')}`
            return h('div', { className: 'dsh-mcp-tool dsh-mcp-import__row', key },
              h(P.Checkbox, {
                checked: picked[key] === true,
                label: server.serverName,
                onChange: (checked) => props.onPick(key, checked),
              }),
              h('span', { className: 'dsh-mcp-tool__desc' }, summary),
              h('span', { className: 'dsh-mcp-field__hint' }, server.sourceLabel))
          })))
        }
      }

      const footer = h('div', { className: 'dsh-mcp__toolbar' },
        h(P.Button, { size: 'sm', variant: 'ghost', onClick: props.onClose }, t('cancel')),
        h(P.Button, { size: 'sm', variant: 'primary', disabled: props.saving, onClick: props.onApply },
          props.saving ? t('saving') : t('importApply')))

      return h(P.Modal, {
        open: props.open,
        onClose: props.onClose,
        title: t('importTitle'),
        closeLabel: t('close'),
        className: 'dsh-mcp-modal',
        contentClassName: 'dsh-mcp-modal__scroll',
        footer,
      }, h('div', { className: 'dsh-mcp-import' }, children))
    }

    /** Delete confirmation. */
    function DeleteModal(props) {
      const t = props.t
      const server = props.server
      const footer = h('div', { className: 'dsh-mcp__toolbar' },
        h(P.Button, { size: 'sm', variant: 'ghost', onClick: props.onClose }, t('cancel')),
        h(P.Button, { size: 'sm', variant: 'primary', onClick: props.onConfirm }, t('confirmDelete')))
      return h(P.Modal, {
        open: server !== null,
        onClose: props.onClose,
        title: t('remove'),
        closeLabel: t('close'),
        description: server === null ? undefined : fill(t('removeConfirm'), { name: server.serverName }),
        footer,
      })
    }

    // -----------------------------------------------------------------------
    // The Settings page
    // -----------------------------------------------------------------------

    /**
     * The registered `settings.section` component.
     * @param props - the shell's owner share (`close`) plus this plugin's
     *   injected face (`t`).
     */
    function McpSection(props) {
      const t = props.t
      const snapshotState = React.useState(null)
      const snapshot = snapshotState[0]
      const setSnapshot = snapshotState[1]
      const loadingState = React.useState(true)
      const loading = loadingState[0]
      const setLoading = loadingState[1]
      const busyIdState = React.useState(null)
      const busyId = busyIdState[0]
      const setBusyId = busyIdState[1]
      const errorState = React.useState(null)
      const error = errorState[0]
      const setError = errorState[1]
      const noticeState = React.useState(null)
      const notice = noticeState[0]
      const setNotice = noticeState[1]
      const queryState = React.useState('')
      const query = queryState[0]
      const setQuery = queryState[1]
      const filterState = React.useState('all')
      const filter = filterState[0]
      const setFilter = filterState[1]
      const detailState = React.useState(null)
      const detail = detailState[0]
      const setDetail = detailState[1]
      const savingState = React.useState(false)
      const saving = savingState[0]
      const setSaving = savingState[1]
      const addOpenState = React.useState(false)
      const addOpen = addOpenState[0]
      const setAddOpen = addOpenState[1]
      const helpOpenState = React.useState(false)
      const helpOpen = helpOpenState[0]
      const setHelpOpen = helpOpenState[1]
      const importOpenState = React.useState(false)
      const importOpen = importOpenState[0]
      const setImportOpen = importOpenState[1]
      const importsState = React.useState(null)
      const imports = importsState[0]
      const setImports = importsState[1]
      const pickedState = React.useState({})
      const picked = pickedState[0]
      const setPicked = pickedState[1]
      const confirmingState = React.useState(null)
      const confirming = confirmingState[0]
      const setConfirming = confirmingState[1]
      const rawDetailState = React.useState('')
      const rawDetail = rawDetailState[0]
      const setRawDetail = rawDetailState[1]

      React.useEffect(() => { ensureStyles() }, [])

      const report = React.useCallback((failure) => {
        if (failure === null || failure === undefined) {
          setError(null)
          return
        }
        setError(String(failure.message === undefined ? failure : failure.message))
      }, [])

      const reload = React.useCallback(async () => {
        setLoading(true)
        try {
          const value = await call('list')
          setSnapshot(value)
          setError(null)
        } catch (failure) {
          report(failure)
        } finally {
          setLoading(false)
        }
      }, [report])

      React.useEffect(() => { reload() }, [reload])

      /** Run one host operation, then refresh and flash a notice. */
      const run = React.useCallback(async (id, operation, successText) => {
        setBusyId(id)
        try {
          const value = await operation()
          setError(null)
          if (successText !== undefined) setNotice(successText)
          await reload()
          return value
        } catch (failure) {
          report(failure)
          return null
        } finally {
          setBusyId(null)
        }
      }, [reload, report])

      const openDetail = React.useCallback(async (server) => {
        setBusyId(server.id)
        try {
          const value = await call('detail', { id: server.id })
          setRawDetail(value.raw === undefined ? '' : value.raw)
          setDetail(value)
          setError(null)
        } catch (failure) {
          report(failure)
        } finally {
          setBusyId(null)
        }
      }, [report])

      const openImport = React.useCallback(async () => {
        setImportOpen(true)
        setImports(null)
        setPicked({})
        try {
          const value = await call('discover', {})
          const next = {}
          const servers = value.servers === undefined ? [] : value.servers
          for (const server of servers) next[`${server.sourceId}:${server.serverName}`] = true
          setImports(value)
          setPicked(next)
          setError(null)
        } catch (failure) {
          setImports({ sources: [], servers: [] })
          report(failure)
        }
      }, [report])

      /** The detail dialog's save, shared by the form and the JSON tab. */
      const saveFromDetail = React.useCallback(async (rawText, draft, tab) => {
        if (detail === null) return
        setSaving(true)
        try {
          const config = tab === 'json' ? { __raw: rawText } : payloadFromDraft(draft)
          await call('save', { id: detail.id, config })
          setNotice(t('saved'))
          setError(null)
          setDetail(null)
          await reload()
        } catch (failure) {
          report(failure)
        } finally {
          setSaving(false)
        }
      }, [detail, reload, report, t])

      const submitAdd = React.useCallback(async (draft) => {
        setSaving(true)
        try {
          const result = await call('add', { config: payloadFromDraft(draft) })
          setNotice(fill(t('added'), { name: result.serverName }))
          setError(null)
          setAddOpen(false)
          await reload()
        } catch (failure) {
          report(failure)
        } finally {
          setSaving(false)
        }
      }, [reload, report, t])

      const applyImport = React.useCallback(async () => {
        const all = imports === null || imports.servers === undefined ? [] : imports.servers
        const chosen = all.filter(server => picked[`${server.sourceId}:${server.serverName}`] === true)
        if (chosen.length === 0) return
        setSaving(true)
        try {
          const result = await call('import', { servers: chosen })
          const added = result.added === undefined ? [] : result.added
          const failed = result.failed === undefined ? [] : result.failed
          setNotice(fill(t('imported'), { n: added.length }))
          if (failed.length > 0) report(failed.map(item => `${item.name}: ${item.message}`).join('; '))
          else setError(null)
          setImportOpen(false)
          await reload()
        } catch (failure) {
          report(failure)
        } finally {
          setSaving(false)
        }
      }, [imports, picked, reload, report, t])

      const servers = snapshot === null || snapshot.servers === undefined ? [] : snapshot.servers
      const needle = query.trim().toLowerCase()
      const visible = servers.filter((server) => {
        if (filter === 'running' && server.state !== 'running') return false
        if (filter === 'stopped' && server.state !== 'stopped') return false
        if (filter === 'failed' && server.state !== 'failed') return false
        if (needle === '') return true
        const description = server.description === undefined ? {} : server.description
        const haystack = [
          server.serverName, server.id, server.command, server.url,
          description.title, description.summary, description.detail,
        ].concat(server.args === undefined ? [] : server.args)
          .concat(server.envKeys === undefined ? [] : server.envKeys)
          .filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(needle)
      })
      const counts = snapshot === null || snapshot.counts === undefined
        ? { total: 0, running: 0, stopped: 0, failed: 0, tools: 0 }
        : snapshot.counts

      const header = h('div', { className: 'dsh-mcp__head', key: 'head' },
        h('h2', { className: 'dsh-mcp__title' }, t('title')),
        h('span', { className: 'dsh-mcp__sub' }, t('subtitle')),
        h('span', { className: 'dsh-mcp__counts' },
          fill(t('countTotal'), { n: counts.total }), ' · ', fill(t('countDetail'), counts)))

      const banners = []
      if (error !== null) {
        banners.push(h('div', { className: 'dsh-mcp-banner dsh-mcp-banner--err', role: 'alert', key: 'error' },
          `${t('failPrefix')}${error}`))
      }
      if (notice !== null) {
        banners.push(h('div', { className: 'dsh-mcp-banner dsh-mcp-banner--ok', role: 'status', key: 'notice' }, notice))
      }

      const toolbar = h('div', { className: 'dsh-mcp__toolbar', key: 'toolbar' },
        h('div', { className: 'dsh-mcp__search' }, h(P.Input, {
          icon: h(P.IconSearchOutlineRegular, { size: 14 }),
          placeholder: t('search'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
          'aria-label': t('search'),
        })),
        h(P.SegmentedControl, {
          id: 'dsh-mcp-filter',
          label: t('filterAll'),
          value: filter,
          options: [
            { value: 'all', label: t('filterAll') },
            { value: 'running', label: t('filterRunning') },
            { value: 'stopped', label: t('filterStopped') },
            { value: 'failed', label: t('filterFailed') },
          ],
          onChange: setFilter,
        }),
        h(P.Button, {
          size: 'sm',
          variant: 'outline',
          disabled: loading,
          icon: h(P.IconRefreshOutlineRegular, { size: 14 }),
          onClick: () => { setNotice(null); reload() },
        }, loading ? t('refreshing') : t('refresh')),
        h(P.Button, {
          size: 'sm',
          variant: 'outline',
          icon: h(P.IconDownloadOutlineRegular, { size: 14 }),
          onClick: openImport,
        }, t('import')),
        h(P.Button, {
          size: 'sm',
          variant: 'ghost',
          icon: h(P.IconQuestionOutlineRegular, { size: 14 }),
          onClick: () => setHelpOpen(true),
        }, t('help')),
        h(P.Button, {
          size: 'sm',
          variant: 'primary',
          icon: h(P.IconPlusOutlineRegular, { size: 14 }),
          onClick: () => setAddOpen(true),
        }, t('add')))

      let listing = null
      if (servers.length === 0) {
        listing = loading
          ? h('div', { className: 'dsh-mcp-empty', key: 'listing' }, h('span', {}, t('loading')))
          : h('div', { className: 'dsh-mcp-empty', key: 'listing' },
              h('span', {}, t('empty')),
              h('span', { className: 'dsh-mcp-note' }, t('emptyHint')))
      } else if (visible.length === 0) {
        listing = h('div', { className: 'dsh-mcp-empty', key: 'listing' }, h('span', {}, t('noMatch')))
      } else {
        listing = h('div', { className: 'dsh-mcp__grid', key: 'listing' }, visible.map(server => h(ServerCard, {
          key: server.id,
          t,
          server,
          busy: busyId === server.id,
          onToggle: (target, enabled) => run(
            target.id,
            () => call('toggle', { id: target.id, enabled }),
            enabled ? t('started') : t('stopped'),
          ),
          onRestart: (target) => run(target.id, () => call('restart', { id: target.id }), t('restarted')),
          onOpen: openDetail,
          onDelete: (target) => setConfirming(target),
        })))
      }

      const profile = snapshot === null || snapshot.profile === undefined ? null : snapshot.profile
      const footerNote = profile === null || profile.dir === undefined ? null : h('div', { className: 'dsh-mcp-note', key: 'profile' },
        h('div', {}, `${t('profileFile')}：`, h('span', { className: 'dsh-mcp-mono' }, profile.dir)),
        profile.patchFile === undefined ? null : h('div', {}, h('span', { className: 'dsh-mcp-mono' }, profile.patchFile)))

      const children = [header]
      for (const banner of banners) children.push(banner)
      children.push(toolbar)
      children.push(listing)
      if (footerNote !== null) children.push(footerNote)
      children.push(h(DetailModal, {
        key: 'detail',
        t,
        detail,
        saving,
        onClose: () => setDetail(null),
        onSave: () => saveFromDetail(rawDetail, null, 'json'),
      }))
      children.push(h(AddModal, {
        key: 'add',
        t,
        open: addOpen,
        saving,
        onClose: () => setAddOpen(false),
        onSubmit: submitAdd,
      }))
      children.push(h(P.Modal, {
        key: 'help',
        open: helpOpen,
        onClose: () => setHelpOpen(false),
        title: t('helpTitle'),
        closeLabel: t('close'),
        className: 'dsh-mcp-modal',
        contentClassName: 'dsh-mcp-modal__scroll',
      }, h(HelpBody, { t, fields: snapshot === null ? undefined : snapshot.fields })))
      children.push(h(ImportModal, {
        key: 'import',
        t,
        open: importOpen,
        saving,
        imports,
        picked,
        onPick: (key, checked) => setPicked(Object.assign({}, picked, { [key]: checked })),
        onClose: () => setImportOpen(false),
        onApply: applyImport,
      }))
      children.push(h(DeleteModal, {
        key: 'delete',
        t,
        server: confirming,
        onClose: () => setConfirming(null),
        onConfirm: () => {
          const target = confirming
          setConfirming(null)
          if (target !== null) run(target.id, () => call('remove', { id: target.id }), t('removed'))
        },
      }))

      return h('section', { className: 'dsh-mcp' }, children)
    }

    // -----------------------------------------------------------------------
    // Plugin entry
    // -----------------------------------------------------------------------

    /** Required client services: slots for the settings seat, locale for copy. */
    const inject = ['slots', 'locale']

    /**
     * Client plugin body: register the dictionaries, then the settings section.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => {
        const disposers = []
        try {
          disposers.push(ctx.locale.register(NS, 'zh', ZH))
          disposers.push(ctx.locale.register(NS, 'en', EN))
        } catch {
          /* a hot reload can race the previous registration; bind() still works */
        }
        return () => { for (const dispose of disposers) dispose() }
      }, 'dsh-mcp-native: dictionaries')

      const t = ctx.locale.bind(NS)

      // The settings shell declares `settings.section`; inject waits for that
      // declaration, so the seat survives a shell that mounts late.
      ctx.slots.inject('settings.section', () => {
        try {
          return ctx.slots.register({
            name: 'settings.section',
            id: 'mcp',
            order: 45,
            label: () => t('nav'),
            locale: NS,
            inject: () => ({ t }),
          }, McpSection)
        } catch {
          return () => {}
        }
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.McpSection = McpSection
    return module.exports
  },
})
