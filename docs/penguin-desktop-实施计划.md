# PenguinHarness macOS 桌面端（penguin-desktop）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 PenguinHarness 套一个 Tauri 2 macOS 桌面壳 + 完全独立的前端（LiveAgent 视觉风格、企鹅 Logo），前端由 penguin server 经 `PENGUIN_WEB_DIST` 同源托管。

**Architecture:** Tauri Rust 端负责探测 Node 运行时、以进程组方式 spawn penguin server、就绪探测与双点退出清理；WebView prod 加载 `http://localhost:7364`（同源，零 CORS/零 IPC，capabilities 清空），dev 走 Vite 1420 + proxy。PenguinHarness 以 git submodule 钉 commit，前端 DTO 从其构建产物 type-only 导入。

**Tech Stack:** Tauri 2（Rust）+ React 19 + Vite 7 + Tailwind 4 + TypeScript；后端为 submodule 内构建的 penguin server（Node ≥ 24）。

**依据文档：** `/Users/kevinchen/penguin-desktop-调研报告与架构草案.md`（下称"报告"）。本计划中所有 `vendor/...` 路径指 submodule `vendor/penguin-harness`。

---

## 全局约定（适用于所有阶段）

**硬约束（每阶段验收都要复查）：**
1. **不修改 submodule 内任何文件。** 每阶段验收跑 `git -C vendor/penguin-harness diff --quiet && echo CLEAN`，必须输出 `CLEAN`。若发现非改不可 → 立即停下报告，等待 fork 决策。
2. 前端**只对接 HTTP/SSE**，绝不 import PenguinHarness 内部运行时模块。唯一例外：**type-only** 导入 DTO（见下）。
3. 设计系统只抄视觉（token/配色/布局数值），不复制 LiveAgent 组件源码。
4. **永远用 `http://localhost:7364`，任何代码/配置不得出现 `http://127.0.0.1:7364`**（报告 §A6：canonical-host guard 会对 127.0.0.1 的 `/api/*` 返回 401）。spawn 时 `HOST=127.0.0.1` 是绑定地址，不受此限。
5. 阶段 1 的进程清理专项验收是硬卡点，不通过不进阶段 2。

**api-client 抽象层（贯穿性规则，各阶段只做增量）：**
- `src/api/client.ts` 是**唯一** fetch 出口：统一 `Content-Type: application/json`（server 的 jsonOnlyWrites 会 415 拒绝非 JSON 写请求，报告 §A2）、统一解析错误包 `{error:{code,message}}` 为 `ApiError`、401 时广播事件路由到登录页。
- `src/api/types.ts` 是**唯一** DTO 入口：经 tsconfig paths 别名 `@penguin-api` → `vendor/penguin-harness/packages/server/dist/api`（构建产物 `.d.ts`，官方声明的 outward DTO contract），`export type { ... }` 转发。任何页面不得直接写 vendor 路径。
- 升级 submodule 后 `pnpm typecheck` 的报错清单即 breaking change 清单（报告 §E4）。
- `src/api/sse.ts` 是唯一 EventSource 出口，内部强制 SSE 连接预算 ≤ 2（报告 §D5）。

**提交纪律：** 每个带 `git commit` 的步骤单独提交，消息用 `feat:/chore:/fix:` 前缀；submodule 指针变更单独提交。

**执行时先确认的环境前提（阶段 0 第一步验证）：** 本机 Node ≥ 24、pnpm 11（corepack）、Rust stable + Xcode CLT、`/Users/kevinchen/penguin-harness` 仓库可作为 submodule 的 commit 参照。

---

## 阶段 0 · 脚手架

**目标：** 创建 `/Users/kevinchen/penguin-desktop`，Tauri 2 + React 19 + Vite 7 + Tailwind 4 跑通空窗口；submodule 就位并完成一次 harness 构建。

**前置依赖：** 无（首阶段）。

**文件改动清单（全部新增）：**
- `/Users/kevinchen/penguin-desktop/`（`pnpm create tauri-app` 生成的整套：`package.json`、`vite.config.ts`、`tsconfig.json`、`src/`、`src-tauri/`）
- `.gitmodules` + `vendor/penguin-harness/`（submodule）
- `scripts/build-harness.sh`（新增）
- `src/index.css`（改为 `@import "tailwindcss";`）
- `docs/`（把报告与本计划复制进仓库归档）

**步骤：**

- [ ] **0.1 环境体检**：`node -v`（≥ 24，harness 构建与运行都需要）；`corepack enable && pnpm -v`（11.x）；`rustc --version`；`xcode-select -p` 有输出。任何一项不满足先装齐再继续。
- [ ] **0.2 创建项目**：`cd /Users/kevinchen && pnpm create tauri-app@latest penguin-desktop`，选 TypeScript / React / pnpm。进入目录 `git init && git add -A && git commit -m "chore: scaffold tauri2 + react19 + vite7"`。
- [ ] **0.3 加 Tailwind 4**：`pnpm add tailwindcss @tailwindcss/vite`；`vite.config.ts` 注册 `@tailwindcss/vite` 插件；`src/index.css` 顶部 `@import "tailwindcss";`。提交。
- [ ] **0.4 加 submodule 并钉 commit**：
  ```bash
  git submodule add https://github.com/Prism-Shadow/penguin-harness vendor/penguin-harness
  PIN=$(git -C /Users/kevinchen/penguin-harness rev-parse HEAD)
  git -C vendor/penguin-harness checkout "$PIN"
  git add .gitmodules vendor/penguin-harness && git commit -m "chore: pin penguin-harness submodule at $PIN"
  ```
- [ ] **0.5 写 `scripts/build-harness.sh`**（内容仅此三行逻辑）：`cd vendor/penguin-harness && pnpm install && pnpm -r build`。**注意用 `pnpm -r build` 而非根 `pnpm build`**——根脚本还会跑 `link:cli` 做全局链接，无谓且可能失败（报告 §A9 依据 `package.json:15-16`）。`chmod +x`，提交。
- [ ] **0.6 构建 harness**：`./scripts/build-harness.sh`。首次约数分钟。
- [ ] **0.7 手工冒烟 server**（不涉及 Tauri）：
  ```bash
  PORT=7364 node vendor/penguin-harness/packages/server/dist/index.js &
  curl -s -o /dev/null -w "%{http_code}" http://localhost:7364/   # 期望 200
  curl -s http://localhost:7364/api/version   # 期望 unauthorized JSON（该端点在 auth 之后挂载，app.ts:359-362；能拿到 JSON 即证明 API 栈正常。登录带 cookie 后返回 {"version":...}）
  kill %1
  ```
- [ ] **0.8 空窗口**：`pnpm tauri dev` 弹出模板默认窗口即可。关闭。提交 `chore: verify harness build + empty window`。

**验收标准（全部可执行）：**
1. `ls vendor/penguin-harness/packages/server/dist/index.js` 与 `ls vendor/penguin-harness/packages/web/dist/index.html` 均存在。
2. 0.7 的两个 curl 分别返回 `200` 与 unauthorized 错误 JSON（未登录的正确行为）；登录带 cookie 后 `/api/version` 返回含 `"version"` 的 JSON。
3. `pnpm tauri dev` 打开窗口无报错退出。
4. `git submodule status` 显示钉住的 commit（无 `+` 前缀）；`git -C vendor/penguin-harness diff --quiet && echo CLEAN` → `CLEAN`。

**风险点：**
- pnpm 版本不匹配：harness 钉了 `packageManager: pnpm@11.18.0`，corepack 会自动切换；若全局 pnpm 更老且 corepack 未启用，install 会报错 → 兜底：`corepack enable`。
- `pnpm -r build` 依赖 workspace 注入同步（报告 §A9），首次全量构建无此问题；后续增量重建务必仍走脚本全量跑。
- create-tauri-app 生成的模板若默认带 Tailwind 3 或旧模板结构，以 0.3 手工接线为准。

**api-client 增量：** 无（本阶段不写前端逻辑）。

---

## 阶段 1 · 后端启动与生命周期

**目标：** Rust 端完成"探测运行时 → 进程组 spawn → 就绪探测 → 显窗加载 `http://localhost:7364` → 双点幂等清理"。过渡期用官方 web UI 验证全链路。

**前置依赖：** 阶段 0 的 harness 构建产物（`server/dist` + `web/dist`）。

**文件改动清单：**
- 新增 `src-tauri/src/server.rs`：运行时探测、spawn、就绪轮询、shutdown（本阶段核心，约 200 行）
- 修改 `src-tauri/src/lib.rs`（或 `main.rs`）：setup hook、window event、run event 接线
- 修改 `src-tauri/tauri.conf.json`：`app.windows[0]` 设 `visible: false`、`url: "http://localhost:7364"`；本阶段 `build.devUrl` 也临时指 `http://localhost:7364`（阶段 2 改回 Vite）
- 修改 `src-tauri/Cargo.toml`：加 `libc`（killpg）与一个轻量 HTTP 探测依赖（reqwest 精简 features 或 ureq）
- 新增 `src-tauri/capabilities/`：清空为最小（零 IPC 设计，报告 §D3）
- 新增 `scripts/check-orphans.sh`：`pgrep -fl "server/dist/index.js|sleep 3600"`，用于验收

**server.rs 行为规格（伪代码级，执行时照此实现）：**

1. **端口预检（adopt 模式）**：spawn 前先 `GET http://localhost:7364/`（1s 超时）。已有任意 HTTP 响应 → 视为外部 server 已在运行，记 `owned = false`，跳过 spawn 且**退出时不杀**（防止误杀用户自己起的 penguin）。这同时是崩溃残留 server 的自愈路径。
- 2. **运行时探测（决策 1 的顺序）**：
   a. `~/.penguin/node/bin/node` 存在且 `node -v` 主版本 ≥ 24 → 用它；
   b. 否则 `/opt/homebrew/bin/node` 存在且 ≥ 24 → 用它；
   c. 都失败 → 回退直接 spawn `~/.penguin/bin/penguin server --port 7364`（官方 launcher 自带 Node 24，报告 §A1）；
   d. 三者皆无 → 弹原生错误对话框（提示安装 Node 24 或官方 penguin）后退出，不留半开状态。
3. **spawn**：`Command::new(<node>).arg("--disable-warning=ExperimentalWarning").arg(<server dist 绝对路径>)`，env 设 `PORT=7364`、`HOST=127.0.0.1`；**本阶段不设 `PENGUIN_WEB_DIST`**（monorepo 默认解析到 `../web/dist` 即官方 UI，报告 §A1 config.ts:50-55；c 路线的 launcher 也自带 web）。`pre_exec` 中 `setsid()`（或 `process_group(0)`）使子进程自成进程组；stdout/stderr 接到日志。`owned = true`，child 存入 `Mutex<Option<Child>>` 的 managed state。
4. **就绪探测**：async 任务轮询 `GET http://localhost:7364/`（redirect 不跟随），**任意 HTTP 状态码（含 302）即 ready**（报告 §A4：无 /health，官方 CLI 同款探测），间隔 100ms、上限 150 次；**每次探测必须带 ~1s 单次超时**——官方 `waitForReady` 的注释（`serve.ts:104-110`）解释了原因：端口被非 HTTP 程序占用时 TCP 连接会成功但响应永久挂起，无单次超时会卡死整个轮询循环（deadline 永远检查不到）。阶段 1 规格 1 的端口预检同样适用此超时。ready 后 `window.show()`；超时则读子进程 stderr 尾部弹错误对话框。
5. **清理（幂等）**：`cleanup()` 内 `Option::take()` 取 child（取不到直接返回，天然幂等；`owned=false` 也直接返回）→ `killpg(pgid, SIGTERM)`（触发 server 的 5s 优雅关闭：deny 审批、abort 任务、清 agent 进程组，报告 §A4）→ 每 200ms `try_wait`，最多 6s → 仍存活则 `killpg(pgid, SIGKILL)` → `wait` 收尸。
6. **三个触发点都接 cleanup**：`WindowEvent::CloseRequested`（关窗）、`RunEvent::ExitRequested`、`RunEvent::Exit`（Cmd+Q 路径在 macOS 上有 ExitRequested 不触发的历史 issue tauri#2464/#9198，报告 §D2——三点冗余 + 幂等即为对策）。

**步骤：**

- [ ] 1.1 写 `server.rs` 骨架（探测 + spawn + adopt 预检），接入 setup hook。提交。
- [ ] 1.2 加就绪轮询与 `visible:false → show()`。`pnpm tauri dev` 应看到官方 Penguin 登录页。提交。
- [ ] 1.3 加三点幂等 cleanup。提交。
- [ ] 1.4 跑完整验收清单（下），全过后提交 `feat: server lifecycle management`。

**验收标准：**
1. `pnpm tauri dev` → 窗口显示官方 Web UI，`admin`/`penguin-2026` 能登录进入。
2. 窗口出现前无白屏闪烁（visible:false 生效；从启动到显窗 < 15s）。
3. **进程清理专项（硬卡点，三个场景全过）**——每个场景先在官方 UI 里发起一个会话并让 agent 执行 `sleep 3600`（审批通过），确认 `pgrep -f "sleep 3600"` 有输出，然后：
   - 场景 A：Cmd+Q 退出 → 8s 内 `./scripts/check-orphans.sh` 无任何输出；
   - 场景 B：点窗口红色关闭钮退出 → 同上；
   - 场景 C：`kill <tauri主进程pid>`（SIGTERM）→ 同上（若此场景清理不触发，记录为已知限制并验证 adopt 预检在下次启动时能接管/自愈，不算卡点失败，但要在验收记录里写明）。
4. adopt 模式：先手工 `PORT=7364 node .../server/dist/index.js` 起一个外部 server，再 `pnpm tauri dev` → 窗口正常加载且退出后**外部 server 仍存活**（`curl localhost:7364` 仍响应）。
5. `git -C vendor/penguin-harness diff --quiet && echo CLEAN` → `CLEAN`。

**风险点：**
- **Cmd+Q 不触发 ExitRequested**（tauri#9198）：已用三点冗余覆盖；若实测某点不触发，以实测为准记录哪点生效。
- **SIGKILL 场景无解**：Tauri 进程被 SIGKILL 时无清理机会（报告 §D2），依赖 adopt 预检自愈 + server 端 `process.on("exit")` 的兜底；写入 README 已知限制。
- **只杀直接 child 不够**：server 的 agent 会 spawn detached 进程组（报告 §A4 session.ts:90-96）——所以必须 SIGTERM 走优雅路径让 server 自己清理下级，超时才 SIGKILL 整组。sleep 3600 验收就是验证这条链。
- 探测阶段 server 启动慢于 150 次上限（首次 SQLite 初始化）：上限可放宽到 300 次，但先按 150 实测。
- devUrl 指向 7364 时 `tauri dev` 会等待该 URL 可达才创建窗口，与我们自己的就绪逻辑可能重复——若冲突，dev 模式下改用先起 server 再起 tauri 的脚本顺序，执行时按实际行为调整（不影响 prod 逻辑）。

**api-client 增量：** 无（仍是官方前端）。

---

## 阶段 2 · 独立前端接管

**目标：** 我方最小前端（登录页 + session 列表）接管 UI；dev 走 Vite 1420 + proxy，api-client/DTO/SSE 三个抽象层立骨架。

**前置依赖：** 阶段 1 的 server 生命周期（dev 时由 Tauri spawn 或 adopt）。

**文件改动清单：**
- 新增 `src/api/client.ts`（fetch 封装 + ApiError + 401 广播）
- 新增 `src/api/types.ts`（`@penguin-api` type-only 转发）
- 新增 `src/api/endpoints/auth.ts`（login/logout/me）、`src/api/endpoints/sessions.ts`（list）
- 新增 `src/features/auth/LoginPage.tsx`、`src/features/sessions/SessionsPage.tsx`
- 新增 `src/app/router.tsx`（`/login`、`/sessions`，未认证重定向）
- 修改 `src/main.tsx`、删除模板演示组件
- 修改 `tsconfig.json`：paths `"@penguin-api": ["./vendor/penguin-harness/packages/server/dist/api"]`
- 修改 `vite.config.ts`：`server.port: 1420`，`server.proxy` 把 `/api` 与 `/preview` 转发 `http://localhost:7364`（官方 web 的 vite.config 同款做法，报告 §D3）
- 修改 `src-tauri/tauri.conf.json`：`build.devUrl` → `http://localhost:1420`，`build.beforeDevCommand` → `pnpm dev:web`；**`frontendDist` 保持 `http://localhost:7364`**（prod 同源方案）
- 修改 `package.json`：`dev:web`（vite）、`typecheck`（tsc --noEmit）脚本

**步骤：**

- [ ] 2.0 **前置实测 `.d.ts` 产出**（决定 DTO 通道走法）：
  ```bash
  ls vendor/penguin-harness/packages/server/dist/api/types.d.ts
  ls vendor/penguin-harness/packages/core/dist/omnimessage/index.d.ts
  ls vendor/penguin-harness/packages/core/dist/interfaces.d.ts
  ```
  三个文件都应存在（两包 tsup 均 `dts: true`，server 显式建了 `api/types` entry，core 显式建了 omnimessage/interfaces 子路径 entry）。若缺失，先排查阶段 0 构建再继续。
- [ ] 2.1 tsconfig paths + `src/api/types.ts`，先只转发 3-5 个登录/会话相关 DTO；`pnpm typecheck` 通过。**预期路径**：`@penguin-api` 一条映射大概率不够——`types.d.ts` 顶部保留着对 core 子路径的 import（`types.ts:16-21`），所以要一并写**子路径级**映射：`@prismshadow/penguin-core/omnimessage` → `.../core/dist/omnimessage/index.d.ts`、`@prismshadow/penguin-core/interfaces` → `.../core/dist/interfaces.d.ts`（若报错再牵出 markers，同法补 `.../markers` 一条）。该契约本就是为前端 type-only import 设计的（`types.ts` 头注释），成功概率高；但**限时尝试（≤30 分钟）**，仍解不干净就直接切兜底②手写镜像 DTO 子集（`src/api/types.ts` 仍是唯一入口，内部由转发改手写），并在阶段验收报告记录偏差。提交。
- [ ] 2.2 `client.ts`：`request()` 统一出口（JSON 头、错误包解析、401 事件）；`endpoints/auth.ts` + `endpoints/sessions.ts`。提交。
- [ ] 2.3 LoginPage（`POST /api/auth/login`，失败展示 `error.message`）+ SessionsPage（`GET /api/sessions`，空态文案）+ router（`GET /api/me` 401 → /login）。样式本阶段用素 Tailwind，不追求视觉。提交。
- [ ] 2.4 vite proxy + tauri.conf 切换 devUrl。`pnpm tauri dev` 走通登录 → 列表。提交 `feat: independent frontend takeover (login + sessions)`。

**验收标准：**
1. `pnpm tauri dev` 打开的是**我方**登录页（非官方 UI）；`admin`/`penguin-2026` 登录成功跳转 sessions 页，列出会话（或空态）。
2. 错误路径：故意输错密码 → 页面展示 server 返回的错误信息（非崩溃/静默）。
3. cookie 会话保持：登录后彻底退出 app 重新 `pnpm tauri dev` → 不需要重新登录直接进列表页（`GET /api/me` 200）。
4. `pnpm typecheck` 通过；`grep -rn "127.0.0.1:7364" src/ src-tauri/tauri.conf.json` 无结果（硬约束 4）。
5. `grep -rn "vendor/penguin-harness" src/ --include="*.tsx" --include="*.ts" | grep -v "api/types.ts"` 无结果（DTO 唯一入口）。
6. submodule CLEAN 检查通过。

**风险点：**
- **DTO 类型解析**：`dist/api/types.d.ts` 引用 core 子路径类型（`types.ts:16-21` 实锤）。兜底顺序——①**子路径级** paths 映射（步骤 2.1 已写明具体两条 + markers 备用，注意不是包根一条）；②仍不行则手写镜像 DTO 子集（唯一入口不变）。①限时 30 分钟，不得卡死在此。**不改 submodule。**
- Vite proxy 与 Host header：proxy 目标是 localhost，`hostOnly` 结果仍是 `localhost`（app host），不会触发 canonical-host guard；无需 `changeOrigin`。若实测 302/401，第一排查点就是这里（报告 §A6）。
- dev 下 cookie 属于 `localhost:1420` origin，prod 属于 `localhost:7364`——两边各自登录一次是预期行为，不是 bug。

**api-client 增量：** `client.ts` 骨架 + auth/sessions 两组端点 + `@penguin-api` DTO 通道（本阶段的核心交付物之一）。

---

## 阶段 3 · 设计系统移植 + Logo + 三态主题

**目标：** 报告 §B 的 token 落地为 `design-system/`；自建基础组件；企鹅 Logo 上 icon 与窗口；light/dark/system 三态主题。

**前置依赖：** 阶段 2 的登录页/列表页（作为视觉验收载体）。

**文件改动清单：**
- 新增 `src/design-system/tokens.css`：§B2 全量 token——浅/深两板 HSL 变量（`--background`/`--foreground`/`--primary`/`--muted`/`--border`/`--sidebar-bg`/语义 success·error·running/气泡色）、圆角（`--radius:0.5rem` + md/lg/xl/2xl 层级）、阴影 scale（rim/sm/lg/模态，深色换黑系）、6px 滚动条
- 新增 `src/design-system/motion.css`：三条缓动曲线变量 + `chatBubbleIn`/`settingsSectionIn` 等核心 keyframes + `prefers-reduced-motion` 全量覆盖块
- 新增 `src/design-system/components/`：`Button.tsx`（default/secondary/ghost/destructive/outline 五变体，视觉照 §B4：primary 实心近黑近白、ghost hover 上 accent、`active:scale-95`）、`Input.tsx`（聚焦无 ring，聚焦感交容器）、`Card.tsx`（半透明边框 `border-border/40~70`）、`Dialog.tsx`（backdrop `bg-black/55 backdrop-blur-sm`、popup rounded-2xl）、`SidebarItem.tsx`（h-30px、选中 `bg-foreground/[0.07]`）
- 新增 `src/app/theme.ts`：三态模型（light→dark→system 循环）、`documentElement.classList.toggle("dark")`、`matchMedia` 订阅、localStorage 持久化
- 新增 `src/app/AppShell.tsx`：侧栏 272px（可折叠 w-0 duration-200）+ 顶栏 ~52px + 主区布局
- 新增 `src/assets/penguin-logo.svg`：**从 submodule 复制**（复制不是修改）`vendor/.../packages/landing/public/penguin-logo.svg`
- 替换 `src-tauri/icons/*`：`pnpm tauri icon src/assets/penguin-logo.svg` 生成（决策 5：白底直接生成，精致化留阶段 5）
- 修改 `src/index.css`：引入两个 design-system css；修改字体栈为 §B 的 `ui-sans-serif, system-ui, "PingFang SC", "Microsoft YaHei"` + mono 栈
- 修改 LoginPage / SessionsPage：换用 design-system 组件与 AppShell

**步骤：**

- [ ] 3.1 `tokens.css` + `motion.css` 落地（照报告 §B2 数值表逐项抄，不发明新值）。提交。
- [ ] 3.2 五个基础组件 + AppShell。提交。
- [ ] 3.3 `theme.ts` 三态 + 顶栏切换按钮。提交。
- [ ] 3.4 Logo：复制 SVG → `tauri icon` → 确认 `src-tauri/icons/icon.icns` 更新；登录页放窗口内 logo。提交。
- [ ] 3.5 两个既有页面套新皮。提交 `feat: design system + penguin branding + theming`。

**验收标准：**
1. DevTools 量取：侧栏 `offsetWidth === 272`；`getComputedStyle(document.documentElement).getPropertyValue("--radius")` 为 `0.5rem`；正文底色浅色 `#ffffff`、深色近 `#12151c`。
2. 主题：顶栏按钮循环 light→dark→system；system 态下切换 macOS 外观 app 实时跟随；重启 app 主题记忆保留。
3. Logo：Dock 图标为企鹅；`ls -la src-tauri/icons/icon.icns` 修改时间为本阶段。
4. 视觉抽查清单（对照报告 §B4 逐项打勾）：primary 按钮为实心近黑（深色下近白）；输入框聚焦无 ring；卡片边框半透明；侧栏选中态为灰度叠加非彩色。
5. `prefers-reduced-motion`（系统开"减弱动态效果"）下入场动画全部消失。
6. submodule CLEAN；`grep -rn "LiveAgent" src/` 无结果（没有复制其源码）。

**风险点：**
- Tailwind 4 中 HSL 变量接线方式与 LiveAgent（Tailwind v4 + `@config` 桥 v3 配置）不同——我们直接用 v4 的 `@theme` 原生写法映射同样数值，**抄的是值不是接线方式**。
- `tauri icon` 对该 SVG 的光栅化若出现渐变异常，兜底：先用浏览器/`rsvg-convert` 导出 1024px PNG 再喂给 `tauri icon`。
- 白底 logo 在深色 Dock 下略突兀属预期（决策 5），阶段 5 处理。

**api-client 增量：** 无新端点；登录/列表页替换组件时不得绕过 client.ts。

---

## 阶段 4 · 功能铺开

**目标：** Chat（SSE 双通道）、Settings（agent config/vault/models/skills）、Skills 库、Traces、Benchmarks、Usage 六个功能面逐页落地；不建 projects/members/admin 页（决策 7）。

**前置依赖：** 阶段 2 的 api-client 骨架、阶段 3 的组件库；**数据前提**：`~/.penguin/data` 中已存在至少一个 project + agent（阶段 1 用官方 UI 创建过即满足；否则先临时切回官方 UI 建一个，或等阶段 5 引导页——验收前置在各页注明）。

**文件改动清单：**
- 新增 `src/api/sse.ts`：SSE 管理器——全局 `/api/events` 常连 1 条 + 当前会话 `/api/sessions/:id/stream` 至多 1 条（**切会话先 close 旧的再 open 新的**，总预算 ≤ 2，报告 §D5）；`Last-Event-ID` 重连；收到 `resync_required` 触发消息重拉
- 新增 `src/api/endpoints/`：`tasks.ts`（tasks/steer/approvals/abort/compact）、`agents.ts`（agent CRUD/config/vault/export/import）、`models.ts`、`skills.ts`、`schedules.ts`、`traces.ts`、`benchmarks.ts`、`usage.ts`、`version.ts`
- 扩充 `src/api/types.ts`：随页面逐步转发所需 DTO（含 `ServerEvent` union）
- 新增 `src/features/chat/`：`ChatPage.tsx`、`MessageList.tsx`（assistant 无气泡 + user 灰气泡 `rounded-2xl rounded-br-md`，§B4）、`Composer.tsx`（磨砂玻璃 r-24px 悬浮底部）、`ApprovalBar.tsx`（`approval_request` → `POST /approvals/:toolCallId`）、`TaskStateBadge.tsx`、`ToolRow.tsx`（mono 11px 灰字）
- 新增 `src/features/settings/`：`SettingsPage.tsx`（224px 侧栏布局）+ `AgentConfigSection`（GET/PUT config + reset）、`VaultSection`、`ModelsSection`（GET/PUT models + `POST models/test`）、`AgentSkillsSection`（attach/detach）
- 新增 `src/features/skills/SkillsLibraryPage.tsx`（`GET /api/skills`）
- 新增 `src/features/traces/`：`TracesPage.tsx`（agent 级列表）+ `TraceDetail.tsx`（`GET .../traces/:sessionId/:index` + analysis + download 链接）
- 新增 `src/features/benchmarks/BenchmarksPage.tsx`（只读：benchmarks → cases → files/rubric 三级浏览）
- 新增 `src/features/usage/UsagePage.tsx`（usage + errors 两表）
- 新增 `src/app/project.ts`：启动时 `GET /api/projects` 取第一个作为当前 project（单 project 决策），全 app 单例
- 修改 `src/app/router.tsx`、`AppShell.tsx`（侧栏导航：会话列表 + Skills/Traces/Benchmarks/Usage/Settings 入口）

**步骤（每页一个提交 + 一个验收点）：**

- [ ] 4.1 `sse.ts` 管理器 + `project.ts` 单例。提交。
- [ ] 4.2 **Chat**：建会话（`POST .../agents/:A/sessions`）→ 发消息（`POST /tasks`）→ SSE 流式渲染 → 审批 → abort。验收 ①：发"列出当前目录文件"，流式看到回复与工具行；出现审批时点允许后继续；abort 键能中断。验收 ②（连接预算）：DevTools Network 过滤 eventsource，在 3 个会话间连续切换 5 次，任意时刻活跃 SSE ≤ 2。提交。
- [ ] 4.3 **Settings**：四个 section 全部读写成功。验收：改 agent config 一个字段保存后刷新仍在；`POST models/test` 对已配 provider 返回成功提示。提交。
- [ ] 4.4 **Skills 库**：列表 + agent attach/detach。验收：给 agent 挂/摘一个库内 skill，Settings 的 AgentSkillsSection 状态同步。提交。
- [ ] 4.5 **Traces**：列表 + 详情 + analysis + 下载。验收：打开 4.2 产生的会话 trace，能看到逐条内容；下载得到 .jsonl。提交。
- [ ] 4.6 **Benchmarks**：三级只读浏览。验收：default agent 的示例 benchmark（harness 预置）能浏览到 case 文件内容。提交。
- [ ] 4.7 **Usage**：两表渲染。验收：4.2 的对话产生的用量出现在表中（金额/тokens 非零）。提交。
- [ ] 4.8 全局回归：六页导航互切无白屏、无 console 错误；进程清理专项（阶段 1 场景 A）复测一次。提交 `feat: full feature surface`。

**验收标准（汇总）：** 4.2–4.7 各页验收点全过；SSE 预算实测 ≤ 2；`pnpm typecheck` 过；`grep -rn "projects/.*members\|/api/admin" src/features` 无结果（决策 7：多用户面未实现）；submodule CLEAN。

**风险点：**
- **SSE 6 连接上限**（§D5 最大坑）：一切多开逻辑（如后台会话也开 stream）都被 `sse.ts` 单例禁止；code review 时检查没有任何组件直接 `new EventSource`。
- `resync_required`：Last-Event-ID 重连 miss 时 server 会先发它（报告 §A3）——必须实现"重拉 `GET /messages` 再续流"，否则消息错乱。
- 新连接首个事件是 `task_state` 快照（§A3）：UI 初始状态以它为准，不要在连上前自行猜测任务态。
- 审批流阻塞：`approval_request` 未处理时任务挂起——ApprovalBar 必须全局可见（不限当前滚动位置）。
- Benchmarks/Usage 数据可能为空（新数据目录）：空态设计进验收（预置 example benchmark 仅 default_agent 有，报告 §F）。
- 单 project 假设被打破（用户手动建了多个）：`project.ts` 取第一个并在 Settings 页显示当前 project 名，不做切换器（记录为已知限制）。

**api-client 增量：** 本阶段完成 client 的全部端点覆盖（约 9 个 endpoint 模块）+ `sse.ts` 成为唯一 SSE 出口。

---

## 阶段 5 · 首启引导 + macOS 打包

**目标：** 空数据/默认密码引导页；`tauri build` 产出自包含 .app（ad-hoc 签名，免公证）；打包后 spawn 链路与进程清理复验；Logo 精致化。

**前置依赖：** 阶段 4 全功能面；阶段 1 的运行时探测逻辑（本阶段扩展 prod 路径解析）。

**文件改动清单：**
- 新增 `src/features/onboarding/OnboardingFlow.tsx`：登录后检测——①前端记录本次登录密码是否为 `penguin-2026`，是则强制走改密步骤（`PUT /api/me/password`）；②`GET /api/projects` 为空 → 建 project（`POST /api/projects`）→ 建 agent（`POST .../agents`）→ 配 provider（`PUT .../models` + `POST models/test`）三步向导；完成前拦截进入主界面
- 新增 `scripts/bundle-harness.sh`：在 submodule 内执行 `pnpm --filter @prismshadow/penguin-cli --prod deploy /Users/kevinchen/penguin-desktop/dist-harness --config.node-linker=hoisted`（官方 release 同款打平产物，报告 §A9；输出目录在 submodule **外**，不违反硬约束）
- 修改 `src-tauri/tauri.conf.json`：`bundle.resources` 携带 `../dist-harness/**` 与 `../dist/**`（我方前端 build 产物）；`bundle.targets: ["app"]`；identifier/productName 定稿
- 修改 `src-tauri/src/server.rs`：prod（`cfg!(not(debug_assertions))`）路径解析——server 入口用 `resource_dir()/dist-harness/dist/index.js`（deploy 产物的 CLI 入口，以 `server` 子命令启动）或直接 node 执行；`PENGUIN_WEB_DIST` 设为 `resource_dir()/dist/`（我方前端）；dev 分支维持阶段 1 逻辑
- 新增 `src/assets/penguin-logo-padded.svg`：外包一层 ~10% 留白的新文件（决策 5 精致化；**新文件**，不改原 SVG），重跑 `pnpm tauri icon`
- 修改 `package.json`：`build:web`、`bundle` 编排脚本（build-harness → bundle-harness → vite build → tauri build）

**步骤：**

- [ ] 5.1 OnboardingFlow（改密 + 三步向导），用**全新** `PENGUIN_HOME`（临时目录）实测空库全流程。提交。
- [ ] 5.2 `bundle-harness.sh` 跑通；`node dist-harness/dist/index.js server --port 7999` 手工冒烟（curl 200/302 后杀掉）。提交。
- [ ] 5.3 tauri.conf 资源接线 + server.rs prod 路径分支。提交。
- [ ] 5.4 Logo 精致化：padded SVG → `tauri icon` → 对比 Dock 观感。提交。
- [ ] 5.5 `pnpm bundle` 产出 .app；拷到 `/Applications` 做验收清单。全过后提交 `feat: onboarding + macOS packaging`，打 tag `v0.1.0`。

**验收标准：**
1. **空库首启**：`rm -rf` 测试用 `PENGUIN_HOME` 后启动打包 app（该变量经临时脚本注入或直接用真实空环境）→ 依次走完 改密 → 建 project/agent → 配 provider → 进入主界面并成功发一条消息。
2. **默认密码检测**：用 `penguin-2026` 登录必弹改密页，改完后旧密码登录失败、新密码成功。
3. **打包产物自包含**：`codesign -dv /Applications/PenguinDesktop.app` 显示 ad-hoc（`Signature=adhoc`）；在**未安装官方 penguin、且 PATH 无 node** 的模拟条件下（临时 `PATH=/usr/bin:/bin` 启动）app 仍能起 server——若决策 1 的探测链在此条件下全失败，确认错误对话框文案正确指引安装 Node（记录实际行为）。
4. **打包后进程清理复验**：对 /Applications 里的 app 重跑阶段 1 专项场景 A、B，`check-orphans.sh` 无输出。
5. 双击打开无 Gatekeeper 拦截（本机构建无 quarantine，报告 §D4）。
6. `du -sh /Applications/PenguinDesktop.app` 记录体积（预期几十 MB 级，不含 Node 运行时）。
7. submodule CLEAN；`git status` 工作区干净（dist-harness/、dist/ 已入 .gitignore）。

**风险点：**
- **deploy 产物 + 资源签名**：`bundle.resources` 携带上千个 node_modules 文件会拖慢打包与签名，ad-hoc 下可接受；若 `tauri build` 对资源内 `.node` 二进制签名报错，兜底：resources 改为打 tar 随包、首启解压到 `~/Library/Application Support/penguin-desktop/`（路径解析对应调整）。
- **deploy 产物的 CLI 入口是否需要 `PENGUIN_CLI_ENTRY`**：不设时仅 `POST /api/version/update` 返回 `unsupported`（报告 §A1），前端隐藏"检查更新"按钮即可，不是问题。
- prod 下 `PENGUIN_WEB_DIST` 指向 resource 内前端 → 官方 launcher 回退路径（决策 1c）会被我们显式设置的该变量覆盖其自带 web（launcher 只在未设时才 export，报告 §A1）——两条 spawn 路径都要设此变量，执行时统一在 spawn env 处设置。
- 空库首启时 server 冷启动（建 SQLite/目录）可能比日常慢：就绪探测上限如阶段 1 风险所述可放宽。
- Onboarding 的"密码是否默认"只能靠前端比对用户输入（server 无此暴露接口），用户改过密码又改回 `penguin-2026` 会再次触发——可接受的边角。

**api-client 增量：** `endpoints/onboarding` 无需新建——复用 auth/projects/agents/models 已有方法；version 端点用于"关于"页显示版本（`GET /api/version` 与 submodule 钉的版本比对，报告 §E4 的版本探测落地点）。

---

## 执行期修订记录

- 2026-08-04 阶段 0：实测确认钉住 commit 上 `/api/version` 挂载于 auth 中间件之后（`app.ts:359-362`）——未登录返回 unauthorized 是正确行为。已修订 0.7 预期与阶段 0 验收项 2；对后续无实质影响（就绪探测本就用 `GET /`，前端版本显示本就在登录后）。阶段 1 若需登录前判活，唯一可用信号是 `GET /` 的任意 HTTP 响应。

## 返修记录（2026-08-04 人工审核）

1. 阶段 1 就绪探测补单次 ~1s 超时（依据 `serve.ts:104-110`，审核修正 1，采纳）。
2. 阶段 2 新增步骤 2.0 前置实测 `.d.ts`（审核修正 3，采纳；文件名按 core tsup entry 实际产物修正为 `dist/omnimessage/index.d.ts`）。
3. 阶段 2 兜底①改写为**子路径级** paths 映射并限时 30 分钟（审核修正 2 引用属实；概率判断纠偏——core 为 omnimessage/interfaces 显式生成独立 dts 且契约本为前端 type-only import 设计，兜底①成功率高，但保留随时切兜底②的预案）。
4. 执行形态定为子代理驱动，加"机械护栏前置"与"阶段 4 共享文件由主会话合并"两条加固（审核建议，采纳并补充并行边界）。

## 自检记录（对任务书的覆盖核对）

- 六阶段与任务书逐条对应 ✅；每阶段含文件清单/前置/可执行验收/风险/api-client 增量五要素 ✅
- 7 项决策落点：①运行时探测链（阶段 1 规格 2 + 阶段 5 验收 3）②cookie（阶段 2 验收 3）③引导页（阶段 5.1）④自进化不做（全计划无涉）⑤Logo 两步走（3.4 / 5.4）⑥三态主题（3.3）⑦砍多用户面（阶段 4 验收 grep）✅
- 硬约束四条 + 阶段 1 硬卡点在"全局约定"与各阶段验收中反复出现 ✅
- localhost vs 127.0.0.1（§A6）：全局约定 4 + 阶段 2 验收 4 的 grep 检查 ✅；进程清理（§D2）：阶段 1 规格 5-6 + 三场景 + 阶段 5 复验 ✅；SSE 预算（§D5）：sse.ts 单例 + 阶段 4 验收实测 ✅

---

## 执行方式（已定：子代理驱动）

按审核意见执行：每个阶段内的任务派独立子代理实现，主会话只做任务间 review 与阶段末验收，**每完成一个阶段停下来交验收清单**，不连续推进。两条加固：
1. **机械护栏前置**：每阶段所有子代理产出合并后、进入验收清单前，主会话先跑"全局约定"四条机械检查（submodule CLEAN、无 `127.0.0.1:7364`、DTO 唯一入口 grep、无 `/api/admin` grep），任一失败先修再验收。
2. **阶段 4 并行的边界**：六个功能页可并行派发，但 `src/api/types.ts` 与 `src/app/router.tsx`/`AppShell.tsx` 是共享文件——并行子代理各自只写自己的 `features/<page>/` 与 `endpoints/<page>.ts` 新文件，共享文件的增量（DTO 转发行、路由注册、侧栏入口）由主会话在合并时统一编辑，避免六个代理互相覆盖。步骤 4.1（sse.ts + project.ts）必须先于并行批次完成。
