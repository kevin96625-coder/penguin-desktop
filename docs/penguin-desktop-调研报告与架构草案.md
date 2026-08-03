# PenguinHarness macOS 桌面端 — 调研报告与架构设计草案

> 调研日期：2026-08-03。五路并行调研：PenguinHarness 后端（源码级）、LiveAgent 设计系统（源码级）、Tauri 2 集成（官方文档 + issue 验证）、PenguinHarness 自进化机制深挖、开源自进化项目外部调研。所有结论附文件路径或来源依据。

---

## 执行摘要（先读这个）

1. **原架构方向基本成立，但有一处必须推翻**：任务书假设"WebView 指向 `127.0.0.1:7364` 走 HTTP/SSE"。实测代码证明这条路走不通——server **没有任何 CORS 中间件**，且有一个 canonical-host guard：默认配置下 `http://127.0.0.1:7364/api/*` 会被 **401 拒绝**（即使带有效 cookie）。正确做法是**同源托管方案**：`PENGUIN_WEB_DIST` 指向我方前端 dist，WebView 加载 `http://localhost:7364`（注意是 `localhost` 不是 `127.0.0.1`）。这反而更简单：零 CORS、cookie 自动维持、SSE 直连，且完全不碰官方代码——只是一个环境变量。
2. **Tauri 2 壳 + 独立前端 + submodule 三个大方向全部确认可行**，Tauri 壳的职责收敛为"进程管家 + 原生窗口 + 打包"，capabilities 可清空。
3. **LiveAgent 设计系统完整提取**，可直接照抄的 token 表、布局常量、动效曲线齐备（§B）。
4. **额外调研**：PenguinHarness 自进化闭环完整但有 10+ 处结构性薄弱点（§F），LiveAgent 的 Memory/File Ledger/Hooks/MCP 可对症补强（§F.3），开源领域 GEPA/Voyager/ExpeL/OpenHands microagents 提供了成熟设计模式（§G）。

---

## A. PenguinHarness 后端调研

### A1. `penguin server` 启动

- CLI bin：`packages/cli/package.json:26` — `"penguin": "./dist/index.js"`；serve 命令定义在 `packages/cli/src/commands/serve.ts:133-159`。
- **`penguin server` 不 spawn 子进程**：CLI 设置 `PORT`/`HOST` 环境变量后直接 `await import("@prismshadow/penguin-server")`，server 跑在 CLI 进程内（`serve.ts:78-97`）。
- 默认端口 7364：`packages/core/src/internal/ports.ts:35`（`DEFAULT_SERVER_PORT`）；默认 host `127.0.0.1`（`packages/server/src/config.ts:88`）。
- **必须先 build**（`pnpm install && pnpm build`），源码不可直接运行（core 的 exports 指向 dist/，`README.md:211`）。
- **Node ≥ 24 是硬性要求**：用了 `process.getBuiltinModule("node:sqlite")`（`packages/server/src/db/database.ts:16`）。官方 release 内嵌 Node v24.18.0。
- 从 Rust 端 spawn 的最小命令行（跳过 CLI wrapper，等价于 server 包的 `start` 脚本）：

```bash
PORT=7364 HOST=127.0.0.1 PENGUIN_WEB_DIST=<我方前端dist> \
  node --disable-warning=ExperimentalWarning <submodule>/packages/server/dist/index.js
```

- 关键环境变量（均非必填，`packages/server/src/config.ts:76-95`）：

| 变量 | 含义 | 默认 |
|---|---|---|
| `PENGUIN_HOME` | 数据根目录 | `~/.penguin/data` |
| `PORT` / `HOST` | 监听地址 | `7364` / `127.0.0.1` |
| `PENGUIN_WEB_DIST` | 静态前端目录（**我方接管点**） | server 包内 `web-dist/` 或 monorepo `../web/dist` |
| `PENGUIN_WEB_DB` | SQLite 路径 | `<root>/web.db` |
| `PENGUIN_PREVIEW_ORIGIN` | Workspace HTML 预览的隔离 origin | 未设（用 127.0.0.1 做 preview host） |
| `PENGUIN_UPDATE_CHECK=off` | 关闭 GitHub 更新检查（server 唯一外呼） | 开启 |

### A2. 鉴权

- **HttpOnly cookie session**，非 basic/JWT/token。cookie 名 `penguin_session`（`packages/server/src/auth/middleware.ts:17`），`SameSite=Lax`、`Max-Age` 7 天、滑动续期（剩余 <6 天时续，`auth/service.ts:107-124`）。**带 Max-Age → WKWebView 重启后保留**。
- 登录：`POST /api/auth/login` `{userId, password}`；首个用户 seed 为 `admin` / `penguin-2026`（`auth/service.ts:24-25`）。
- **无任何禁用鉴权 / 注入 token 的通道**（grep 确认）。session 哈希存 SQLite `auth_sessions` 表。
- 同源方案下 WebView 什么都不用做：登录一次，cookie 由 WKWebView 持久 data store 保存（`~/Library/WebKit/<bundle id>/`），fetch/EventSource 自动携带。只要 7 天内用过一次就永不掉线（滑动续期）。
- 已知 MVP 缺口（作者自述，`packages/server/README.md:37-43`）：无 CSRF token、无登录限速。本地回环场景可接受。

### A3. HTTP API 全貌（挂载：`packages/server/src/app.ts:356-387`）

| 分组 | 端点 |
|---|---|
| auth | `POST /api/auth/login` · `POST /api/auth/logout` |
| me | `GET /api/me` · `PUT /api/me/password` · `GET/PUT /api/me/prefs` |
| admin | `GET/POST /api/admin/users` · `POST .../:userId/password` · `DELETE .../:userId` |
| version | `GET /api/version` · `GET /api/version/update-check` · `POST /api/version/update` |
| projects | `GET/POST /api/projects` · `PATCH/DELETE /api/projects/:P` · members CRUD |
| models | `GET/PUT /api/projects/:P/models` · `POST .../models/test` |
| agents | `GET/POST .../agents` · `DELETE .../agents/:A` · `GET/PUT .../config` · `POST .../config/reset` · `GET/PUT .../vault` · `GET .../export` · `POST .../import` · `GET /api/projects/:P/dirs` |
| skills | `GET /api/skills`（库） · `GET/POST .../agents/:A/skills` · `DELETE .../skills/:name` |
| schedules | `GET/POST .../schedules` · `GET/PUT/DELETE .../schedules/:name` |
| benchmarks | 只读 6 个 GET（列表/cases/files/rubric） |
| traces | agent 级 5 个端点 + session 级 3 个端点 + `POST .../traces/import` |
| usage | `GET /api/projects/:P/usage` · `.../usage/errors` |
| sessions | `GET/POST .../agents/:A/sessions` · `GET /api/sessions` · session 级 20 个端点（messages/stream/tasks/steer/approvals/abort/compact/files/scratchpad…） |

**SSE 两条通道，无 WebSocket**：
- `GET /api/sessions/:id/stream`（会话流）与 `GET /api/events`（用户级）。
- 格式（`packages/server/src/http/sse.ts`）：无名 event 载 OmniMessage；`server_event` 载 `ServerEvent` union（`approval_request`/`task_state`/`session_title`/`resync_required`/goal/schedule 等，`api/types.ts:746-812`）。20s 心跳、`Last-Event-ID` 重放、miss 时发 `resync_required`；新连接首个事件必是 `task_state` 快照。

### A4. 生命周期

- 启动序列（`packages/server/src/index.ts:18-44`）：dotenv → config → seedAdmin → scheduler.start → 端口监听（还会额外绑一个 `::1` 监听）。
- **没有 /health 端点**（grep 确认）。就绪探测采用官方 CLI 自己的方式：`GET /`（redirect: manual），**任意 HTTP 响应（含 302）即视为 ready**（`packages/cli/src/commands/serve.ts:99-119`）。
- SIGTERM/SIGINT 优雅退出：scheduler.stop → sessionManager.shutdown(5s，deny 所有审批、abort 所有任务) → SSE dispose → db.close，另有 1s 硬退出兜底（`index.ts:65-83`）。
- **孤儿进程风险真实存在**：agent 的 `exec_command` 以 `detached: true` 进程组方式 spawn shell（`packages/core/src/environment/tools/command/session.ts:90-96`）；清理靠 `process.on("exit")`，**SIGKILL 时不触发**。→ Rust 端必须对整个进程组发信号（见 §D2）。

### A5. 数据目录

- `~/.penguin/data`（或 `PENGUIN_HOME`）：`web.db`（SQLite，仅索引/聚合） + `<projectId>/agents/<agentId>/{agent_state, traces, scratchpad, workspaces, benchmarks, snapshots}`。
- **数据与代码完全分离**，代码注释明确写明设计意图（`packages/core/src/state/paths.ts:19-22`），submodule 升级不会碰数据。✅

### A6. CORS / Origin（E1 重点，结论前置到执行摘要）

- **无 CORS 中间件、从不读 Origin header**，唯一检查的是 `Host`。项目文档自证："Same-origin only — no CORS middleware is enabled"（`packages/docs/content/server-api.en.md:39`）。
- canonical-host guard（`app.ts:319-333` + `services/preview-token.ts:126-133`）：默认配置下 `localhost` 是 app host，`127.0.0.1` 被保留为 preview host——**在 127.0.0.1 上访问 `/api/*` 一律 401**（有测试用例佐证：`test/workspace-preview.test.ts:258-264`），页面请求 302 到 localhost。
- 结论：
  - **WebView 必须指向 `http://localhost:7364`**；
  - 跨域方案（前端打进 app、origin `tauri://localhost` 直调 API）在不改 server 的前提下**不可行**（无 CORS 头，JSON POST 的 preflight 会 404）；
  - 同源方案下 preview 隔离机制（预览 iframe 走 127.0.0.1）照常工作，不需要设 `PENGUIN_PREVIEW_ORIGIN`。

### A7. 静态托管（我方接管点）

- `app.ts:390-392`：`PENGUIN_WEB_DIST` 存在即注册 SPA 静态路由（`/api` 之后注册，catch-all 拒绝 serve `/api/` 路径，有路径穿越防护）。
- **把 `PENGUIN_WEB_DIST` 指向我方前端 dist = server 同源托管我的 UI**，官方 web 完全不参与。环境变量只作用于我们 spawn 的子进程，不影响用户独立使用 CLI。

---

## B. LiveAgent 设计系统（可抄清单）

> 完整 token 表来自 `crates/agent-gui/src/index.css`（浅色 :168-247，深色 :249-326）。栈：Tailwind 4 + shadcn 结构（primitive 为 @base-ui/react）+ CVA。颜色为 HSL 三元组。

### B1. 整体气质

**"扁平骨架 + 玻璃焦点"的高密度极简开发者工具**：中性无彩灰阶（主色即近黑/近白，无品牌彩色），`text-xs` 是主力字号（555 次 vs `text-sm` 244 次），间距大量用半步（6px/10px）；仅在关键交互面（输入框、hero 卡、跳底按钮）切换到 Apple 材质语言——`backdrop-blur(24px) saturate(165~180%)` + 白色 rim-light + 大扩散低透明投影。

### B2. 核心 token（建自己 design-system 照此表）

**浅色**：`--background 0 0% 100%` · `--foreground 222.2 84% 4.9%`(#020817) · `--primary 222.2 47.4% 11.2%`(#0f172a，近黑) · `--muted 210 40% 96.1%` · `--muted-foreground 215.4 16.3% 46.9%` · `--border 214.3 31.8% 91.4%` · `--sidebar-bg 220 14% 96%` · `--destructive 0 84.2% 60.2%` · 语义：success `152 60% 42%` / error `0 72% 51%` / running(紫) `252 56% 57%` · 用户气泡 `220 9% 91%`。

**深色**：`--background 224 22% 9%`(#12151c) · `--foreground 210 30% 96%` · `--primary` 反转为近白 · `--muted/secondary/accent 220 18% 17%` · `--muted-foreground 215 18% 76%`（刻意提亮） · `--border 220 14% 26%` · `--sidebar-bg 224 22% 11%` · 玻璃面用**白色低透明叠加**（`bg-white/[0.06]` + `border-white/[0.10]`），不是变黑。

**圆角**：`--radius: 0.5rem`。层级约定——控件 6px(md)、列表行/图标按钮 8px(lg)、浮层/卡片 12px(xl)、大卡/Dialog 16px(2xl)、**输入框玻璃卡 24px**、药丸 full。用户气泡非对称：`rounded-2xl rounded-br-md`。

**阴影**（归纳 scale）：所有玻璃面必带 rim `inset 0 1px 0 rgba(255,255,255,.55)`（深色 `.06`）；sm `0 4px 12px -8px rgba(15,23,42,.18)`；lg `0 12px 40px -14px rgba(15,23,42,.22)`；模态 `0 32px 80px -24px rgba(0,0,0,.35)`。深色一律换 `rgba(0,0,0,.55~.72)`。

**动效**：主力 ease-out `cubic-bezier(0.16,1,0.3,1)`；exit `cubic-bezier(0.4,0,1,1)` 0.12s；弹性 `cubic-bezier(0.34,1.56,0.64,1)`。时长：popup 0.18s、主力过渡 duration-200、卡片入场 0.3s。列表全部 `nth-child` 交错入场（0.02s~0.05s 步进）。`prefers-reduced-motion` 全覆盖。

**字体**：`ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei"`；代码 `"SF Mono", Menlo, Monaco, ...`；仅用户气泡用内嵌 OpenAI Sans Semibold woff2（我方可省略此项）。

### B3. 布局常量

侧栏 **272px**（关闭 w-0，duration-200）；侧栏行高统一 **30px**；顶栏 ~52px；macOS 标题栏留白 38px；Chat 正文列 **768px**（可拖 560–1200）、`px-5 py-4`；Composer `max-w-768px` 绝对定位悬浮底部 `pb-4`；Settings 侧栏 224px；右 Dock 默认 420px；滚动条 6px。

```
┌──────────────────────────────────────────────────────────────┐
│ ●●●                                        (标题栏留白 38px)  │
├──────────────┬───────────────────────────────────────────────┤
│ 侧栏 272px    │ 顶栏 ~52px  [模型选择器 h-8]        [主题][面板]│
│ sidebar-bg   ├───────────────────────────────────────────────┤
│ 行高 30px     │        正文列 max-w 768px 居中                 │
│ 选中态:       │        assistant 无气泡 / user 灰色气泡右对齐   │
│ fg/[0.07]    │        工具行: mono 11px 灰字                  │
│              │   ╭──────────────────────────────╮            │
│ [⚙ 设置]     │   │ 磨砂玻璃输入框 r-24px 悬浮     │            │
└──────────────┴───╰──────────────────────────────╯────────────┘
```

### B4. 组件视觉要点

- 按钮：primary=实心近黑/近白（纯明度反差）；ghost 是最高频（无底，hover 上 accent）；按压 `active:scale-95`。
- 输入框：**聚焦无视觉变化**（全局清 focus ring），聚焦感交给容器 `focus-within:` 阴影加深。
- 卡片：边框永远半透明 `border-border/40~70`，不用实心。
- 侧栏选中态：`bg-foreground/[0.07]` 明度叠加，**不引入色相**。
- 消息：只有用户有气泡；assistant 裸铺画布 + 7×7 圆头像。
- 代码块：header 透明 h-8 11px、body `rounded-xl bg-muted/40 p-4` 13px；shiki `github-light/dark` 双主题。
- 深浅色：`<html class="dark">` + `darkMode:["class"]`，三态 light/dark/system。

---

## C. Logo 与 .icns

- `packages/landing/public/penguin-logo.svg`（4.6KB，web/docs 各有一份 byte-identical 副本）。
- 形态：viewBox `139 129 954 954`，**clipPath 圆角方形（rx=230，约 24% 圆角）+ 不透明白色底板**——本身就是 app-icon 构图。主体深藏青渐变（#111b2a→#091423）企鹅 + 电光蓝 #015dfc 动势线。路径复杂（手绘级），**不可单色化/currentColor 化**，不适合 16px 重描。
- 工具链：**`pnpm tauri icon penguin-logo.svg` 一条命令直接生成 .icns + 全平台图标**（官方 icon 命令接受带透明的方形 PNG/SVG）。注意两点：① 白底占满整个圆角矩形，作为 macOS 图标基本可用，但按 Apple 图标网格最好留 ~10% 内边距（可在 SVG 外包一层再喂给 tauri icon）；② 窗口内 logo 直接引用 SVG 即可。
- 仓库内无 .ico/.png favicon，SVG 兼任 favicon（`packages/web/index.html:8`）。

---

## D. Tauri 2 集成

### D1. 脚手架与兼容性

- `pnpm create tauri-app@latest`（create-tauri-app 4.7.x；tauri core 2.10.x / cli 2.11.x）。
- **React 19 + Vite 7 + Tailwind 4 无已知兼容问题**（Tauri 对前端栈无感知；社区已有大量同栈模板）。Vite 7 要求 Node ≥ 20.19。

### D2. spawn + 健康检查 + 退出清理（idiom）

- 本项目 server 不是单二进制，**不走 sidecar/externalBin**，用 `std::process::Command`（或 tokio）直接 spawn `node …/server/dist/index.js`。
- 启动流程：窗口 `visible:false` → setup hook spawn（**设 `process_group(0)` 自成进程组**）→ async 任务轮询 `GET http://localhost:7364/`（100ms 间隔，~15s 超时，任意响应即 ready）→ `window.show()`。
- 退出清理（**Tauri 不会自动杀子进程**，[discussion #3273]）：`WindowEvent::CloseRequested` 与 `RunEvent::Exit` 两处幂等清理；对**负 pgid** 发 SIGTERM（触发 server 的 5s 优雅关闭，连带 agent 的 detached 进程组由 server 自己清）→ 等 ~6s → 仍存活则 `kill(-pgid, SIGKILL)`。macOS 上 Cmd+Q 路径曾有 ExitRequested 不触发的 issue（tauri#2464/#9198），双点清理即为对策。

### D3. WebView 指向与 CSP

- **prod**：`frontendDist` 填 `"http://localhost:7364"`（remote URL 模式）。窗口 origin 即 server origin，同源零 CORS。代价：Tauri IPC 默认对 remote origin 关闭——本设计前端零 IPC，正好把 capabilities 清空（deny by default，最小攻击面）；日后若需窗口控制，可加 `"remote": {"urls": ["http://localhost:7364"]}` capability。
- **dev**：`devUrl` = Vite dev server（如 1420），Vite `server.proxy` 把 `/api`、`/preview` 转发 `localhost:7364`（官方 web 自己也这么干，`packages/web/vite.config.ts:29-31` 还留了 `PENGUIN_API_PROXY` 变量）——同源、HMR 正常。
- CSP：remote URL 模式下 Tauri 的 CSP 注入不作用于远程页面，由我方前端自己在 index.html 里带 meta CSP（`connect-src 'self'` 即可，全部同源）。

### D4. macOS 打包与 Node 运行时

| 方案 | 评价 |
|---|---|
| **系统 node（推荐起步）** | 本地自用最省事。GUI app 的 PATH 不含 homebrew/nvm，需按 `/opt/homebrew/bin/node`、`~/.penguin/node/bin/node`（官方安装器自带 Node 24！）等候选路径探测 + 校验 `node -v ≥ 24` |
| Resources 内嵌 node + deploy 产物 | 自包含 ~100MB+；官方 release 用 `pnpm --filter penguin-cli --prod deploy` 打平 lib/，可照抄 |
| pkg/bun 单二进制 sidecar | 官方 Tauri 推荐路线，但对 penguin（workspace 注入依赖 + skills 文件读取）改造成本高，暂不推荐 |

- 签名：本机构建本机运行，**ad-hoc 签名足够，无需公证**（无 quarantine 属性，Gatekeeper 不拦）。`tauri build` 未设 identity 时默认 ad-hoc。
- 值得注意：用户已通过官方 install.sh 安装过 penguin 的话，`~/.penguin/bin/penguin` 自带 Node 24 运行时，**Tauri 可直接 spawn `~/.penguin/bin/penguin server`**——这可能是最省事的运行时策略（见开放问题 #1）。

### D5. SSE 在 WKWebView

- EventSource 原生支持，无 Tauri 参与。同源方案下 cookie 自动携带，无需 `withCredentials`。
- **真实的坑：HTTP/1.1 同 host 6 连接上限**，每条 SSE 长连接占一个。PenguinHarness 恰好是双通道设计（`/api/events` + 当前会话 stream）——保持"1 条全局 + 1 条当前会话"共 2 条，切换会话时先关旧的再开新的，永不并发多开 session stream。
- fetch streaming (ReadableStream) 在 WKWebView 可靠，可作为备选；EventSource 的优势是自动重连 + Last-Event-ID（server 端已实现重放，正好用上）。

---

## E. 风险与边界

1. **PENGUIN_PREVIEW_ORIGIN / Origin 校验**：已在 §A6 彻底查清。同源方案下无需配置任何白名单；`tauri://localhost` 不进入任何请求路径。唯一纪律：**永远用 `localhost` 访问，别用 `127.0.0.1`**。
2. **SSE**：可用，注意 6 连接预算（§D5）。
3. **submodule 角色**：**"开发期源码引用 + 构建期产出运行时工件"**，不是 Tauri 编译产物的一部分。前端从 `vendor/penguin-harness/packages/server/src/api/types.ts` 做 **type-only import**（官方明确此文件为"outward DTO contract"，且 package.json 有 `@prismshadow/penguin-server/api` 导出）；运行时工件 = submodule 内 `pnpm build` 后的 dist + node_modules（或 deploy 打平产物）。注意 server dist 非自包含（tsup 无 noExternal，运行时仍从 node_modules 解析 core/skills）。
4. **API 版本对冲**：0.2.0 属 pre-1.0，无版本化 API、无迁移框架。对策三层：① submodule 钉死 commit（本身就是版本锁）；② 前端所有请求走单一 `api-client` 层，DTO 类型从 submodule type-only 导入——**升级 submodule 后 `tsc` 直接把 breaking change 变成编译错误**；③ 启动时 `GET /api/version` 与期望版本比对，不符弹警告。

---

## F. PenguinHarness 自进化机制评估（附加调研 1）

### F.1 现状

自进化**不在 TS 代码里，而在 4 个 SKILL.md 提示词文件里**（agent-creation / benchmark-design / agent-evaluation / agent-optimization，位于 `packages/skills/skills/`）；代码只提供文件读写、tar 快照（`snapshot-service.ts`）和只读展示（benchmarks 路由只有 GET）。闭环：Optimizer 会话提假设 → 改 `AGENTS.md`/自有 SKILL.md → 经 `penguin run` 子进程拉起 Evaluator 按私有 rubric 打分 → **均分严格更高即接受** → 模型自己把分数写进 `scoreboard.yaml`。完全人工触发。

### F.2 薄弱点（按严重度）

| # | 薄弱点 | 依据 |
|---|---|---|
| ① | **无 held-out 验证集**——在同一冻结 Case 矩阵上迭代接受，定义上就是在测试集上做梯度下降 | `agent-optimization/SKILL.md:24` |
| ② | **接受判据无统计显著性**——runs=2~3、LLM 评分组内跳动可达 20 分，均值差 0.01 也算改进 | `SKILL.md:58`、`example-benchmark.ts:35` |
| ③ | **被拒 Candidate 不落盘**——失败假设随会话蒸发，下次重复踩坑 | `SKILL.md:130,55` |
| ④ | **评测隔离靠提示词自觉**——Optimizer 的 read_file/exec_command 无路径黑名单，rubric 就在本机可 cat；污染不可检测 | `read-file.ts:6`、`SKILL.md:44` |
| ⑤ | **scoreboard 全部数值模型手写且明令禁止校验**——静默丢弃坏条目 | `SKILL.md:130`、`benchmark-service.ts` |
| ⑥ | Reference 与 Candidate 不同时评测，无配对设计，混入时间漂移 | `SKILL.md:52` |
| ⑦ | cost/duration 记录但不进判据（与"1/70 成本"卖点矛盾） | `SKILL.md:58,113-125` |
| ⑧ | 快照无 list/restore API，轮内回滚靠模型上下文记忆 | `agent-transfer.ts` |
| ⑨ | **`memory/` 目录 mkdir 了但零实现**——文档承诺了不存在的能力 | `paths.ts:127`、`agent-state.ts:154` |
| ⑩ | AGENTS.md 是唯一进化载体，无条目化/去重/遗忘/冲突消解，长程必然膨胀成互相打架的规则堆 | `agent-state.ts:453` |
| ⑪⑫ | MCP 只有配置无实现（`environment.ts:146`）；进化无自动触发器 | |

### F.3 从 LiveAgent 借鉴（优先级排序）

| 排序 | 借鉴项 | 解决 | 价值/难度 |
|---|---|---|---|
| 1 | **File Ledger 模式** → scoreboard 聚合值由代码从 `runs[]` 重算，UI 标 mismatch（"机器维护的确定性地板垫在 LLM 生成之下"，`fileLedger.ts`） | ⑤⑧ | ★★★★★ / ★ |
| 2 | **Memory 体系**（Markdown 事实源 + FTS5 索引 + 回合后静默提取 + organizer scan→cluster→plan→gate；organizer 正是 AGENTS.md 膨胀的解法：把进化规则当记忆条目管理） | ⑨⑩ | ★★★★★ / ★★★★ |
| 3 | **Subagent readonly/worktree 模式 + apply_policy**（Candidate 在隔离区构建，过评测才 apply；回滚=删 worktree） | ④⑧ | ★★★★ / ★★★ |
| 4 | **Hooks 生命周期**（8 事件 × shell/http）→ `agent_end` 挂"累积 N 次会话自动排优化" | ⑫ | ★★★★ / ★★ |
| 5 | MCP adapter（补完已暴露给用户但不工作的配置项） | ⑪ | ★★★ / ★★ |
| 6 | AskUserQuestion（人类偏好采集，校准 LLM 评分方差） | ② | ★★★ / ★★ |

反向结论：自进化、Benchmark、Agent 版本化/可移植、多租户、成本中心、Goal 循环这六项 **PenguinHarness 明显更强**，LiveAgent 无对应物。

---

## G. 开源自进化项目借鉴（附加调研 2）

代表项目全景（stars 为 2026-08-03 实测）：Voyager 7.1k（技能库+self-verification 门禁）、OpenEvolve 6.8k（LLM 变异+MAP-Elites 存档）、GEPA 6.0k（trace 反思进化，胜 RL）、DGM 2.2k（benchmark 实证+archive 分支）、DSPy 36.6k（`compile(program, trainset, metric)` 优化器抽象）、mem0 62.4k（ADD/UPDATE/DELETE 冲突消解）、Letta 24.1k（agent 自编辑常驻记忆）、AWM（trace 抽象参数化为 workflow）、ExpeL（insight 投票汰劣）、OpenHands 83k（**microagents：TS + markdown skills + frontmatter 触发器 + 渐进式披露**——与 PenguinHarness 技术栈最贴近的生产级参照）、Live-SWE-agent（在线"顺手造工具"reflection hook，0 离线成本打赢花 1231 小时的 DGM）。

**对 PenguinHarness 最值得优先落地的 5 个设计模式**：

1. **GEPA 式主循环**：失败 benchmark run 的完整 trace 交给反思 LLM 诊断 → 产出对具体 skill 文件的定向 diff；候选按**逐实例 Pareto 前沿**保留而非平均分（直接缓解薄弱点 ①②）。
2. **技能入库门禁 + 生命周期**：新 skill 须实测通过才入库（Voyager）；frontmatter 带 `confidence/hits/failures` 计数投票汰劣（ExpeL）；冲突走 UPDATE/MERGE（mem0）。
3. **OpenHands microagents 文件格式**：frontmatter 声明 triggers/paths，系统 prompt 只常驻目录（name+description），命中才注入全文——解决 skills 增多后的上下文爆炸。
4. **DGM/OpenEvolve 的 archive**：skill 文件 git 版本化 + 每版关联成绩单 + 允许从次优祖先分支；每次改动跑回归子集防遗忘。
5. **双通道**：在线通道（任务收尾加一步"有无值得沉淀的套路"reflection，AWM 式参数化后存 draft skill）+ 离线通道（benchmark 验证后转正）。Live-SWE-agent 证明便宜的在线通道性价比最高，应最先建。

---

## 架构设计草案

### 1. 关键决策（对原方向的修订）

| 原方向 | 修订 | 理由 |
|---|---|---|
| WebView 指向 `127.0.0.1:7364` | → **`http://localhost:7364`**，且前端由 server 经 `PENGUIN_WEB_DIST` 同源托管 | canonical-host guard 401 + 无 CORS（§A6） |
| （隐含）前端打进 Tauri bundle 跨域调 API | → prod 用 remote URL 模式（`frontendDist: "http://localhost:7364"`） | 跨域不可行；同源反而更简单，cookie/SSE 全自动 |
| 其余（Tauri 2 壳、独立前端、submodule、只借鉴视觉） | **不变，全部确认可行** | |

### 2. 目录结构

```
penguin-desktop/
├── vendor/
│   └── penguin-harness/            # git submodule，钉死 commit
├── src/                            # React 19 + Vite 7 + Tailwind 4（TS）
│   ├── design-system/
│   │   ├── tokens.css              # §B 的 token 表落地（浅/深两板）
│   │   ├── motion.css              # 三条缓动曲线 + keyframes
│   │   └── components/             # Button/Input/Card/Dialog/Tabs…（自建，视觉照 §B4）
│   ├── api/
│   │   ├── client.ts               # 唯一 fetch 出口（错误规范化、401 → 登录页）
│   │   ├── sse.ts                  # 双通道 EventSource 管理（≤2 条并发、Last-Event-ID 重连）
│   │   └── types.ts               # type-only re-export ← vendor/.../server/src/api/types.ts
│   ├── features/
│   │   ├── auth/  chat/  agents/  skills/  benchmarks/  traces/  usage/  settings/
│   └── app/                        # 路由、布局壳（侧栏 272px + 顶栏 + 主区）、主题
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── server.rs               # spawn(进程组) / 就绪轮询 / 双点退出清理
│   ├── icons/                      # tauri icon 生成的 .icns 等
│   ├── capabilities/               # 空（零 IPC）
│   └── tauri.conf.json             # devUrl: :1420；frontendDist: "http://localhost:7364"
├── scripts/
│   ├── build-harness.sh            # cd vendor/penguin-harness && pnpm i && pnpm build
│   └── dev.sh
├── vite.config.ts                  # dev proxy: /api,/preview → localhost:7364
└── package.json
```

### 3. 启动时序

```
Tauri main
  │ 1. 探测 node（~/.penguin/node/bin/node → /opt/homebrew/bin/node → PATH），校验 ≥24
  │ 2. spawn 进程组：PORT=7364 HOST=127.0.0.1 PENGUIN_WEB_DIST=<app>/frontend-dist \
  │       node vendor/.../packages/server/dist/index.js
  │ 3. 轮询 GET http://localhost:7364/ （100ms × ≤150 次；任意 HTTP 响应=ready）
  │ 4. 创建/显示窗口 → WebView 加载 http://localhost:7364
  │ 5. 前端：GET /api/me → 401 则渲染登录页 → POST /api/auth/login → cookie 落盘
  │ 6. 打开 /api/events 全局 SSE + 进入会话时开 session stream
  └─ 退出：CloseRequested/RunEvent::Exit → SIGTERM(-pgid) → 等 6s → SIGKILL(-pgid)
```

### 4. submodule 依赖关系

```
penguin-desktop (git repo)
 ├─(dev-time, type-only)──→ vendor/penguin-harness/packages/server/src/api/types.ts
 ├─(build-time)──→ vendor 内 pnpm build 产出 server/dist + node_modules
 └─(run-time)──→ Tauri spawn node 执行上述 dist；数据在 ~/.penguin/data（升级不受影响）
     前端 dist ──(经 PENGUIN_WEB_DIST)──→ 由 server 同源托管
```

### 5. 开发工作流

`pnpm dev` 一条命令并行起三件事：
1. penguin server（submodule dist，`PENGUIN_WEB_DIST` 可不设或指向占位）；
2. Vite dev server（1420，proxy `/api`/`/preview` → 7364）；
3. `tauri dev`（devUrl 指向 1420；Rust 端 dev 模式检测到 7364 已被占用则跳过 spawn，方便前端热重载时 server 不重启）。

### 6. 升级工作流

```
cd vendor/penguin-harness && git fetch && git checkout <新 tag/commit>
cd ../.. && ./scripts/build-harness.sh        # 重装重编
pnpm typecheck                                 # DTO 变更 → 编译错误即 breaking 清单
pnpm dev 冒烟（登录/会话/SSE/审批）
git add vendor/penguin-harness && git commit   # 提交新指针
```

### 7. 自进化加强的落地路径（独立于桌面壳）

桌面壳承诺"不改官方代码"，而 §F 的加强项都要改 core/server——两条线必须分开：
- **桌面壳线**：只消费 API，永不 fork。
- **harness 加强线**（若做）：fork 或 feature branch，优先做投入产出比最高的三项——① scoreboard 代码重算（File Ledger 模式，纯函数级改动）；② benchmark 目录加 `holdout/` + 接受判据升级；③ hooks 触发器。做完可提上游 PR；桌面壳的 submodule 可随时切到自己的 fork commit，架构不变。

---

## 开放问题清单（需要你决策）

1. **Node 运行时策略**：A) 探测系统/官方安装的 node（最省事，推荐起步）；B) app 内嵌 node + deploy 产物（自包含 ~100MB+）；C) 若用户已装官方 penguin，直接 spawn `~/.penguin/bin/penguin server`（零构建，但版本不受 submodule 控制）。A 与 C 可组合（优先 submodule 构建产物，缺 node 时回退）。
2. **登录体验**：a) 就用 cookie 7 天滑动续期（零开发，常用即永不掉线）；b) Tauri 侧存凭证（keychain）自动 POST login（彻底无感，但要 Rust 侧写 keychain 逻辑）。建议先 a。
3. **首启引导**：首次运行数据目录为空时，是否做"改默认密码 + 配置第一个 model provider"的引导页？（admin/penguin-2026 直接用有安全提示需求）
4. **自进化加强是否纳入本期 scope**：桌面壳与 harness 加强是两个项目。是否先只做壳，加强项后续单独立项（fork + PR 上游）？
5. **Logo 处理**：白底圆角方形直接 `tauri icon` 生成（最快），还是先按 Apple 图标网格加 ~10% 留白/重新裁切（更精致）？
6. **深浅色**：跟随系统（macOS 原生感）还是照 LiveAgent 三态（light/dark/system 手动循环）？建议三态。
7. **前端覆盖面**：官方 web 有 projects/members/admin 多租户面。单机桌面场景是否砍掉多用户管理，只保留单 admin + 单默认 project 的简化 UI？（API 都在，砍的只是页面）
