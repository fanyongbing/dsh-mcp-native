# dsh-mcp-native

**DSH 本机 MCP 管理器** — 把 MCP 服务器当**原生 Loader 行**来管。

在 **设置 → MCP 服务** 里管理本机全部 MCP 服务器：卡片列表、搜索、启动/停用/重启、MCP 说明、配置编辑、从本机其他客户端导入。

> 零依赖 · 零构建 · 手写纯 JS，clone 下来直接能跑。

[![CI](https://github.com/fanyongbing/dsh-mcp-native/actions/workflows/ci.yml/badge.svg)](https://github.com/fanyongbing/dsh-mcp-native/actions/workflows/ci.yml)

[English](#english) · 中文

---

## 为什么叫 "native"

这个插件不引入第二份配置存储。**每个 MCP 服务器就是 profile 里的一行原生 Loader 行**（`@deepseek-ai/dsh-mcp-client`），和手写 `cordis.yml` 得到的完全一样：

| 你点的操作 | 实际发生的事 | 落在哪个文件 |
|---|---|---|
| 启动 / 停用 | `ctx.pluginManager.setPluginEnabled(entryId, enabled)`；行不可寻址时回退到 `entry.update({ disabled })` + `tree.write()` | `<profile>/cordis.patch.yml`（前者）或 `cordis.yml`（后者） |
| 重启 | 先停后启 —— 这是重连配额用尽后唯一能恢复该服务器的办法 | 同上 |
| 保存配置 | `ctx.configEditor.edit(entry, change)`；无该服务时回退到 `entry.update({ config })` + `tree.write()` | `<profile>/cordis.patch.yml` 或 `cordis.yml` |
| 新增 / 删除 | 文件型 Include 树的 `tree.create()` / `tree.remove()` | `<profile>/cordis.yml` |
| 列出 / 读状态 | `ctx.loader.entries()` 过滤 `options.name === '@deepseek-ai/dsh-mcp-client'` | 只读 |
| 工具清单 | `ctx.tools.schemas()` 过滤 `mcp__<serverName>__` 前缀 | 只读 |

**停用是真的停用**：插件实例被销毁 —— 连接关闭、stdio 子进程结束、工具从注册表注销、`mcpResources` provider 移除。没有「假停用」。

**零构建**：`lib/index.js`（宿主半边）和 `lib/client.js`（浏览器半边）都是手写可读的纯 JS。没有 TypeScript、没有 tsdown、没有 `prepare` 脚本，因此从 git 安装时也不需要跑构建。

---

## 功能

| 能力 | 说明 |
|---|---|
| **卡片列表** | 状态点、服务名、传输方式徽章、说明摘要、命令/地址、环境变量名、工具数量、工具清单 |
| **搜索** | 按服务名、loader id、命令、地址、说明、参数、环境变量名实时过滤 |
| **状态筛选** | 全部 / 运行中 / 已停用 / 异常 |
| **启动 · 停用 · 重启** | 见上表；重启用于从「重连次数用尽」状态恢复 |
| **MCP 说明** | 内置 18 个常见 MCP 服务器的说明库 + 从配置推导的兜底说明；「说明」页列出全部生效设置、官方文档链接、**已注册工具及各自描述** |
| **配置编辑** | 表单模式（基本信息 / stdio / HTTP / 高级 / 重连策略）+ JSON 原始模式，支持 `!!js` 表达式双向转换 |
| **字段说明** | 官方 `@deepseek-ai/dsh-mcp-client` 全部 16 个配置字段的含义与默认值 |
| **新增 / 删除** | 直接增删 profile 中的 Loader 行 |
| **从本机导入** | 扫描 Claude Desktop、Claude Code、Cursor、Windsurf、VS Code 以及项目 `.mcp.json` / `.claude/settings.json`，勾选后写入当前 profile |

---

## 安装

### 从 GitHub（推荐）

```bash
dsh plugin --profile desktop add github:fanyongbing/dsh-mcp-native
```

需要本机有 `git`。**不需要**跑 `pnpm build` —— 这个仓库没有构建步骤。

### 从本地源码（开发用）

```bash
git clone https://github.com/fanyongbing/dsh-mcp-native.git
dsh plugin --profile desktop add link:/absolute/path/to/dsh-mcp-native
```

`link:` 安装后改 `lib/client.js` 刷新页面即生效；改 `lib/index.js` 需要重启 dsh（见「开发」）。

### 从 npm

包名 `dsh-mcp-native` 目前未被占用，可自行 `npm publish` 后用：

```bash
dsh plugin --profile desktop add dsh-mcp-native
```

也可以在 **设置 → Plugins** 里通过插件管理器 / 插件市场安装。

安装后设置导航里会出现 **MCP 服务**（`settings.section` 的 `mcp` 条目，order 45）。

---

## 它是怎么工作的

插件是一个「双半边」DSH 包：

```
dsh-mcp-native/
├── package.json          # dsh.bundle.patch + dsh.client 双半边声明
├── cordis.patch.yml      # 把宿主行 dsh-mcp-native 插入 profile
├── lib/
│   ├── index.js          # 宿主半边：/mcp-native 路由 + Loader 操作
│   ├── client.js         # 浏览器半边：设置页（window.__ModuleLoader__ 手写包）
│   ├── catalog.js        # 配置字段说明 + 常见 MCP 服务器说明库
│   └── discover.js       # 本机其他客户端 MCP 配置扫描
└── test/                 # 零依赖测试，CI 直接跑
```

- **宿主半边**用 `ctx.webServer.register({ kind: 'prefix', path: '/mcp-native' })` 暴露一组 JSON 路由。
- **浏览器半边**用 `ctx.slots.register` 往 `settings.section` 注册一个设置区块，通过 `fetch` 调用那些路由。
- 这条 HTTP 通道是第三方 DSH 插件唯一可用、**不依赖 typert 代码生成**的宿主↔浏览器通路；自定义 Remote 命名空间需要 monorepo 内部的生成器，第三方拿不到。

---

## 关于「运行中」的诚实说明

`@deepseek-ai/dsh-mcp-client` **没有发布任何连接状态 API** —— `client`、`connectedAt`、`failedAttempts` 都是 `startConnection` 里的闭包变量，外部拿不到。并且默认 `failOnStartupError: false` 时，**即使首次连接失败，插件 fiber 仍然是 ACTIVE**。

所以本插件明确区分两件事：

- **运行中** = Loader 行已挂载、MCP 客户端已拿到连接机会。**不等于**连接成功。
- **工具列表** = 连接成功**唯一**的直接证据。

界面在「说明」页把这一点写出来了，不用状态点冒充连接状态。指向一个不存在的地址时，你会看到「运行中 + 0 个工具」，这是正确且诚实的显示。

---

## 配置字段

配置写在 profile 的 Loader 行里，一行一个服务器：

```yaml
- id: mcp-github
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: github
    transport: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-github']
    env:
      GITHUB_TOKEN: !!js process.env.GITHUB_TOKEN
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `transport` | 必填 | `stdio` 或 `streamable-http`（**没有 SSE**） |
| `serverName` | 必填 | 工具名前缀：模型看到 `mcp__<serverName>__<tool>`，`[A-Za-z0-9_-]{1,32}` |
| `command` / `args` / `env` / `cwd` | — | stdio：可执行文件、参数、追加环境变量、工作目录 |
| `url` / `headers` | — | streamable-http：端点地址与附加请求头 |
| `toolCallTimeoutMs` | 60000 | 单次工具调用/资源请求超时 |
| `maxInstructionBytes` | 32768 | 服务器说明的最大字节数，超限拒绝连接 |
| `failOnStartupError` | false | 为 true 时首次连接失败会让插件加载失败 |
| `reconnect.*` | 见界面 | `enabled` / `initialDelayMs` / `maxDelayMs` / `maxAttempts` |

两个容易踩的坑：

1. **`transport` 在 schema 里不是必填**，但缺了它 `createTransport` 会返回 `undefined`，连接**静默失败**。本插件保存时总是显式写入。
2. **环境变量会被擦除**：名称匹配 `/KEY|PASSWORD|SECRET|TOKEN/i` 以及全部 `DSH_*` 的父进程变量不会传给子进程，只有行里显式声明的才会 —— 所以密钥写在 `env` 里是安全的。

---

## 开发

```bash
git clone https://github.com/fanyongbing/dsh-mcp-native.git
cd dsh-mcp-native
npm test          # 71 项检查，零依赖，无需 npm install
```

- `test/host.test.mjs` —— **50 项**宿主半边集成测试。起真实 HTTP server 打真实路由，用忠实复刻的 Cordis 替身（文件型 Include 树 / Loader 内存树 / configEditor / pluginManager / tools），覆盖增删改查、`!!js` 往返、可寻址与不可寻址两条路径、以及各类非法输入拒绝。
- `test/client.test.mjs` —— **21 项**浏览器半边契约测试。扮演宿主的模块加载器，跑插件工厂与 `apply`，断言设置区块注册的形状与双语文案的完整性。

### 改动生效规则（重要）

| 改了 | 生效方式 |
|---|---|
| `lib/client.js` | client-modules 按文件修订号重新提供 bundle —— **刷新页面**即可 |
| `lib/index.js` | **需要重启 dsh**。Loader 会缓存插件模块，实测 `pluginManager` 摘下再挂上、直接 touch 文件都不会让它重新导入 |

---

## 限制

这些都是上游约束，不是本插件的实现选择：

- **无法枚举「已连接」的服务器集合，也读不到单台服务器的连接状态** —— 上游没有这个 API。
- **无法在不切换 Loader 行的情况下启动/停止单台服务器** —— 没有更轻的操作。
- **重连次数用尽后无法强制重连**，只能「重启」该行或重启 dsh。
- **只支持 `stdio` 与 `streamable-http`**，SSE 服务器无法直接配置。
- 宿主半边是本地回环 HTTP 路由，读到的是 profile 的真实配置（**含 `env` 值**），请在可信环境下使用。

## 兼容性

- DSH `>= 0.2.0-rc.1`（`dsh.engines.dsh`）
- Node `>= 20`
- 需要 `settings.section` 插槽存在（`@deepseek-ai/dsh-client-ui-settings-general` 提供）。用 `ctx.slots.inject` 等声明，因此会话在完全没装设置壳的部署里也不会报错。

## License

[MIT](LICENSE)

---

<a id="english"></a>
## English

**dsh-mcp-native** — manage this machine's MCP servers as **native DSH Loader rows**, from a Settings page.

Every MCP server *is* a `@deepseek-ai/dsh-mcp-client` Loader entry in your profile — there is no second, private config store. Start/stop drives the row's `disabled` flag (the same mechanism the harness uses), config edits go through `configEditor`, and add/remove uses the file-backed include tree's own `create`/`remove`. Stopping a server really stops it: the plugin instance is disposed, the socket closed, the stdio child killed, its tools unregistered.

**Cards · search · start/stop/restart · documentation · config editor · import from other local clients.**

**Zero dependencies, zero build.** `lib/index.js` and `lib/client.js` are hand-written, readable JavaScript — no TypeScript, no bundler, no `prepare` script. `git clone` and it runs.

```bash
dsh plugin --profile desktop add github:fanyongbing/dsh-mcp-native
npm test    # 71 checks, no install needed
```

**Honest status reporting:** `@deepseek-ai/dsh-mcp-client` publishes no connection-state API, and with the default `failOnStartupError: false` a never-connected server still leaves its fiber `ACTIVE`. So the UI never claims a state dot means "connected" — the tool list is the only direct evidence of a live connection.

MIT licensed.
