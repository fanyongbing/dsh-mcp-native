/**
 * Static knowledge for the MCP manager: what the `@deepseek-ai/dsh-mcp-client`
 * row accepts, and human descriptions for servers people commonly configure.
 *
 * This module is pure data — no Cordis, no filesystem — so both the host half
 * and the reasoning in the client half can rely on the same field list.
 * @module dsh-mcp-native/catalog
 */

/** The profile row name that mounts one MCP server. */
export const MCP_PLUGIN_NAME = '@deepseek-ai/dsh-mcp-client'

/**
 * Every accepted `Config` field of the MCP client row, in presentation order.
 * `group` drives how the settings editor lays the form out.
 */
export const CONFIG_FIELDS = [
  {
    key: 'serverName',
    label: '服务名称 serverName',
    type: 'string',
    required: true,
    group: 'basic',
    summary: '工具名前缀：工具会以 mcp__<serverName>__<tool> 暴露给模型。',
    detail: '取值范围 [A-Za-z0-9_-]{1,32}，在同一个注册作用域内必须唯一。它是本地命名空间，不取远端 serverInfo.name。',
  },
  {
    key: 'transport',
    label: '传输方式 transport',
    type: 'enum',
    values: ['stdio', 'streamable-http'],
    required: true,
    group: 'basic',
    summary: '本地程序用 stdio，远端服务用 streamable-http。',
    detail: 'stdio 会先拉起一个临时探针进程完成协议协商，再启动正式进程。',
  },
  {
    key: 'command',
    label: '命令 command',
    type: 'string',
    group: 'stdio',
    transport: 'stdio',
    summary: 'stdio 传输下要启动的可执行文件。',
    detail: '例如 npx、uvx、node、python，或某个可执行文件的绝对路径。',
  },
  {
    key: 'args',
    label: '参数 args',
    type: 'stringList',
    group: 'stdio',
    transport: 'stdio',
    summary: '传给命令的参数列表，每行一个。',
    detail: '例如 -y 与 @modelcontextprotocol/server-filesystem 分两行填写。',
  },
  {
    key: 'env',
    label: '环境变量 env',
    type: 'keyValue',
    group: 'stdio',
    transport: 'stdio',
    summary: '追加到子进程的环境变量；父进程环境会先做敏感信息擦除。',
    detail: '名称匹配 /KEY|PASSWORD|SECRET|TOKEN/i 以及全部 DSH_* 的环境变量会被丢弃，这里显式声明的值会保留。',
  },
  {
    key: 'cwd',
    label: '工作目录 cwd',
    type: 'string',
    group: 'stdio',
    transport: 'stdio',
    summary: 'stdio 子进程的工作目录。',
    detail: '留空时继承 dsh 进程的当前目录。',
  },
  {
    key: 'url',
    label: '服务地址 url',
    type: 'string',
    group: 'http',
    transport: 'streamable-http',
    summary: 'Streamable HTTP 端点地址。',
    detail: '例如 http://localhost:3000/mcp。',
  },
  {
    key: 'headers',
    label: '请求头 headers',
    type: 'keyValue',
    group: 'http',
    transport: 'streamable-http',
    summary: '附加到每次请求的 HTTP 头，常用于 Authorization。',
    detail: '值可以写成 !!js 表达式来读取环境变量，避免把密钥明文写进配置。',
  },
  {
    key: 'toolCallTimeoutMs',
    label: '调用超时 toolCallTimeoutMs',
    type: 'number',
    group: 'advanced',
    default: 60000,
    summary: '单次 tools/call 或资源请求的超时时间（毫秒）。',
    detail: '默认 60000，即 60 秒。',
  },
  {
    key: 'maxInstructionBytes',
    label: '说明上限 maxInstructionBytes',
    type: 'number',
    group: 'advanced',
    default: 32768,
    summary: '服务器说明（instructions）允许的最大 UTF-8 字节数。',
    detail: '超限会直接拒绝这次连接，默认 32768。',
  },
  {
    key: 'failOnStartupError',
    label: '启动失败即报错 failOnStartupError',
    type: 'boolean',
    group: 'advanced',
    default: false,
    summary: '首次连接或工具同步失败时，是否让插件加载失败。',
    detail: '默认 false：连接失败只记日志，dsh 照常启动，该服务器不提供工具。',
  },
  {
    key: 'reconnect.enabled',
    label: '自动重连 reconnect.enabled',
    type: 'boolean',
    group: 'reconnect',
    default: true,
    summary: '连接中断后是否自动重连。',
    detail: '关闭后工具仍会列出，但调用会一直失败，直到重新加载配置。',
  },
  {
    key: 'reconnect.initialDelayMs',
    label: '首次重连间隔 reconnect.initialDelayMs',
    type: 'number',
    group: 'reconnect',
    default: 500,
    summary: '第一次重连的等待时间，之后每次翻倍。',
    detail: '默认 500 毫秒。',
  },
  {
    key: 'reconnect.maxDelayMs',
    label: '重连上限 reconnect.maxDelayMs',
    type: 'number',
    group: 'reconnect',
    default: 30000,
    summary: '退避上限；连接保持超过该时长后重试次数配额会重置。',
    detail: '默认 30000 毫秒。',
  },
  {
    key: 'reconnect.maxAttempts',
    label: '重连次数 reconnect.maxAttempts',
    type: 'number',
    group: 'reconnect',
    default: 10,
    summary: '一次中断中连续失败多少次后放弃。',
    detail: '放弃后该服务器的工具会被移除，直到重新加载配置或重启 dsh。',
  },
]

/**
 * Descriptions for servers people actually configure, matched against the
 * row's command/args/url. First match wins, so put the specific ones first.
 */
export const KNOWN_SERVERS = [
  {
    match: ['server-filesystem'],
    title: '文件系统 Filesystem',
    summary: '官方文件系统服务器：在显式授权的目录内读写文件、检索目录树。',
    detail: '把允许访问的目录作为参数传给它；未列出的路径一律拒绝，是最常用的本地 MCP 之一。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
  {
    match: ['server-github', 'github-mcp-server'],
    title: 'GitHub',
    summary: '官方 GitHub 服务器：读写仓库、Issue、Pull Request 与代码搜索。',
    detail: '需要一个 GITHUB_PERSONAL_ACCESS_TOKEN 环境变量；建议只授予所需的最小权限范围。',
    docs: 'https://github.com/github/github-mcp-server',
  },
  {
    match: ['server-git'],
    title: 'Git',
    summary: '本地 Git 服务器：查看状态、差异、提交历史，执行提交与分支操作。',
    detail: '直接操作本地仓库，不访问网络。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
  },
  {
    match: ['server-memory'],
    title: '记忆 Knowledge Graph Memory',
    summary: '知识图谱记忆服务器：把实体、关系与观察持久化为可检索的长期记忆。',
    detail: '适合跨会话保留项目背景与偏好，数据存成一个本地 JSON 文件。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  },
  {
    match: ['server-sequential-thinking'],
    title: '顺序思考 Sequential Thinking',
    summary: '把复杂问题拆成可修订的思考步骤，逐步收敛到结论。',
    detail: '不访问外部资源，只提供一个结构化的推理草稿工具。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
  },
  {
    match: ['server-fetch'],
    title: '网页抓取 Fetch',
    summary: '抓取网页并转成适合模型阅读的文本，支持 robots.txt 策略。',
    detail: '用于阅读文档与文章；需要联网。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
  },
  {
    match: ['server-everything'],
    title: 'Everything（协议自检）',
    summary: 'MCP 官方自检服务器：覆盖工具、资源、提示与采样等全部协议能力。',
    detail: '排查客户端问题时的标准参照物。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
  },
  {
    match: ['playwright'],
    title: 'Playwright 浏览器自动化',
    summary: '用真实浏览器打开页面、点击、填表、截图并读取可访问性树。',
    detail: '首次运行会下载浏览器内核；适合端到端验证 Web 界面。',
    docs: 'https://github.com/microsoft/playwright-mcp',
  },
  {
    match: ['puppeteer'],
    title: 'Puppeteer 浏览器自动化',
    summary: '无头 Chrome 控制：导航、截图、执行页面脚本。',
    detail: '比 Playwright 更轻，但快照能力偏弱。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
  },
  {
    match: ['server-sqlite', 'sqlite'],
    title: 'SQLite 数据库',
    summary: '对本地 SQLite 文件执行查询与结构探查。',
    detail: '把数据库文件路径作为参数传入；支持只读模式。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
  },
  {
    match: ['server-postgres', 'postgres-mcp'],
    title: 'PostgreSQL 数据库',
    summary: '连接 PostgreSQL，读取表结构与执行只读查询。',
    detail: '连接串通过参数或环境变量传入，注意授予只读账号。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
  },
  {
    match: ['server-slack', 'slack-mcp'],
    title: 'Slack',
    summary: '读取频道消息与发送回复。',
    detail: '需要 Slack Bot Token。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
  },
  {
    match: ['server-time', 'time-mcp'],
    title: '时间与时区',
    summary: '获取指定时区的当前时间并做时间换算。',
    detail: '纯本地计算，不需要网络。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
  },
  {
    match: ['notion'],
    title: 'Notion',
    summary: '检索与更新 Notion 页面、数据库条目。',
    detail: '需要 Notion Integration Token，并显式把页面共享给该集成。',
    docs: 'https://github.com/makenotion/notion-mcp-server',
  },
  {
    match: ['brave-search', 'brave'],
    title: 'Brave 搜索',
    summary: '通过 Brave Search API 做网页与新闻检索。',
    detail: '需要 BRAVE_API_KEY。',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
  },
  {
    match: ['sentry'],
    title: 'Sentry',
    summary: '查询告警、Issue 与堆栈信息。',
    detail: '需要 Sentry 认证令牌。',
    docs: 'https://github.com/getsentry/sentry-mcp',
  },
  {
    match: ['chrome-devtools'],
    title: 'Chrome DevTools',
    summary: '驱动 Chrome 并读取性能轨迹、网络请求与控制台日志。',
    detail: '适合排查前端性能问题。',
    docs: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
  },
  {
    match: ['context7'],
    title: 'Context7 文档检索',
    summary: '按库名检索最新的官方文档片段，减少凭记忆写代码。',
    detail: '可选的 API Key 只影响速率限制。',
    docs: 'https://github.com/upstash/context7',
  },
  {
    match: ['exa', 'tavily', 'firecrawl'],
    title: '联网检索服务',
    summary: '面向模型优化的网页检索与抓取服务。',
    detail: '需要各自服务商签发的 API Key。',
  },
]

/** Fallback descriptions by transport when nothing else matches. */
export const TRANSPORT_FALLBACK = {
  stdio: '本地 stdio 服务器：dsh 按配置启动该进程，通过标准输入输出通信。'
    + '它的工具会以 mcp__<serverName>__<tool> 的形式出现在模型工具列表里。',
  'streamable-http': '远端 Streamable HTTP 服务器：dsh 直接连接该地址，不启动本地进程。'
    + '它的工具会以 mcp__<serverName>__<tool> 的形式出现在模型工具列表里。',
}

/**
 * Match one configured server against {@link KNOWN_SERVERS}.
 * @param haystack - lower-cased command + args + url joined by spaces.
 * @returns the matched entry, or undefined.
 */
export function matchKnownServer(haystack) {
  for (const candidate of KNOWN_SERVERS) {
    for (const needle of candidate.match) {
      if (haystack.includes(needle)) return candidate
    }
  }
  return undefined
}
