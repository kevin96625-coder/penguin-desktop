# 阶段 3 自评报告 · 设计系统移植 + Logo + 三态主题 + 仪表盘视觉预留

> 对照对象：`docs/visual-memory/LiveAgent-Visual-Memory.md`
> 代码范围：`src/design-system/`、`src/app/theme.ts`、`src/app/AppShell.tsx`、`src/features/overview/`、登录页与会话页套皮
> 截图：由主会话评审时补（本报告只做代码层对照，未附运行截图，写明于此）。

## 一、对照清单

### Token（§2.1 / §2.3 / §2.4 / §3）

- [x] 浅色 `:root` 与深色 `.dark` 两块 HSL 变量表**逐项照抄**，含 `chat-*` / `tool-*` / `checkpoint-*` 全部语义 token（`src/design-system/tokens.css`）
- [x] `--radius: 0.5rem`；Tailwind 4 默认 radius 刻度恰好与视觉记忆 §2.3 的 4/6/8/12/16px 映射一致，未另行覆盖
- [x] §2.4 阴影配方定义为 `--shadow-rim / -sm / -composer / -composer-focus / -popover / -modal` 浅深两套；深色 composer-focus 依照视觉记忆"主要靠边框/背景 alpha 上升"保持投影不变
- [x] 6px 全局滚动条，thumb 圆角 3px，alpha .2 → hover .35
- [x] 升级点 §7.4：dark surface ladder 五级 9% → 12% → 15% → 19% → 22.5%（每级 3–4%，向上爬时轻微去饱和），浅色给出等价五级（panel/raised 从 sidebar-bg 与 thinking-bg 家族推导，顶部收敛回白，注释说明每级用途）
- [x] `@theme inline` 将语义色映射为 utilities，`bg-background` / `border-border` / `bg-surface-raised` / `shadow-composer` 等经产物 CSS grep 验证可用
- [x] 字体栈照 §2.2：UI 系统栈 + PingFang SC；code 用 SF Mono 栈；**未内嵌 OpenAI Sans**

### 动效（§2.6 / §6 / §7.6）

- [x] 四条缓动曲线变量：enter (.16,1,.3,1) / exit (.4,0,1,1) / spring (.34,1.56,.64,1) / modal (.22,1,.36,1)
- [x] keyframes：chatBubbleIn（6px/.98、300ms）、sectionIn（12px/.985、220ms）、toolExpandIn（-4px、220ms）、checkpointIn（350ms）
- [x] nth-child 错峰：菜单 20ms 递增第 6 项 120ms 封顶；chip 40ms 递增第 6 项 200ms 封顶
- [x] 升级点 §7.6：`.status-transition`（color/background/border 200ms ease-out）+ 五态语义色（running=chat-running 紫、complete=chat-success、failed=chat-error、blocked=琥珀 38 92% 50%、queued=muted-foreground）+ 1.6s 克制脉冲（仅 opacity）
- [x] `prefers-reduced-motion`：所有 animate-* 与 stagger 置 none，transition（含状态脉冲与 Tailwind transition utilities）压至 1ms

### 组件

- [x] **Primary 实心近黑 / 深色自动反转近白**（`--primary` 本身随主题反转），hover bg-primary/90，`active:scale-95`，无阴影
- [x] **输入框聚焦无 ring 无边框变化**：tokens.css 全局清除 input/textarea/select 的 outline 与 box-shadow；聚焦感交外层 focus-within（登录卡验证）
- [x] **卡片边框永远半透明**：Card 用 `border-border/50`，Dialog `border-border/70`，均落在 40–70 区间
- [x] **侧栏选中灰度叠加不引入色相**：idle text-foreground/85 → hover bg-foreground/[0.05] → active bg-foreground/[0.07]（hover [0.09]）
- [x] Dialog：backdrop `bg-black/55 backdrop-blur-sm`；popup rounded-2xl + `--shadow-modal`；180ms `--ease-modal` 从 translateY(12px) scale(.985) 进场
- [x] StatCard：玻璃轻量版（浅 bg-white/70 + blur-xl + rim；深 white/[0.06] + border-white/[0.10]），带 "—" 空态
- [x] TrendChart：只定 props 接口与容器风格（surface-panel 井 + border/30 网格 + 空态直线示意），文件头写明阶段 4 风格规范（线色 chat-running、无渐变填充），未接图表库
- [x] StatusBadge：低 alpha 背景（.12）+ 实色文字 + 状态点，running 脉冲，接 .status-transition
- [x] SectionHeading：text-sm semibold + 3px 圆角短竖条（灰度 bg-foreground/20，active 换 primary）+ 右侧 action 槽

### 玻璃焦点配方（§5，登录卡逐项核对）

- [x] blur 24px（backdrop-blur-2xl）+ saturate 165%（backdrop-saturate-[1.65]）
- [x] 浅色基面 white/.70 → focus .74；边框 black/.055 → .075
- [x] 深色基面 white/.06 → focus .08；边框 white/.10 → .15
- [x] rim 第一层 inset 0 1px 0 white/.74（focus .78；深色 .08）
- [x] rim 第二层：顶部 1px 渐变线，左右各缩进 20px，transparent → white/.85 → transparent（深色 .15）
- [x] 内部 gloss：white/.18 → 透明（深色 .04）
- [x] 投影：常态 --shadow-composer，focus-within 升级 --shadow-composer-focus；深色黑投影维持高吸收、不放大

### 主题 / 布局 / Logo

- [x] 三态循环 light → dark → system；`resolveEffective()`；`classList.toggle("dark")`；matchMedia change 订阅（仅 system 态挂载）；localStorage `penguin-theme`；首帧前 `initTheme()` 防闪
- [x] 侧栏 272px，折叠 `w-0 opacity-0`，`transition-[width,opacity] duration-200 ease-out`；内层固定 272px 防折叠挤压
- [x] 顶栏 ~52px（py-2.5 + 32px 控件），拖拽区 data-tauri-drag-region；主题钮图标随 light/dark/system 变化
- [x] macOS 标题栏留白 38px（侧栏顶 + 登录页顶）
- [x] 侧栏第一入口 Overview → 占位页；第二 Sessions；底部 Settings 禁用占位
- [x] Logo：`cp` 自 vendor（未修改源）→ `pnpm tauri icon` 生成 .icns/.ico/png 全套 → 登录页 56px（h-14）圆角展示
- [x] 路由：/ → Overview、/sessions → 列表、/login 独立无 AppShell；Protected 与 penguin:unauthorized 逻辑未动

## 二、诚实清单

### 做到

上表全部勾选项；`pnpm typecheck` 与 `pnpm build` 通过；产物 CSS grep 验证 `bg-surface-*` / `shadow-*` utilities 真实生成；tauri dev 启动、curl 1420 返回 HTML（详见提交说明）。

### 没做到 / 有意偏离

1. **StatusBadge 状态点尺寸**：任务书写 "2px 状态点"，实做 6px（h-1.5）。2px 在 11px 徽章内不可见，判断为可读性优先的偏离；如视觉总监坚持 2px，改一处 class 即可。
2. **深色 --shadow-composer-focus 与常态相同**：这是照视觉记忆 §5 "深色 focus 主要靠边框/背景 alpha 上升" 的忠实抄写，不是遗漏；但意味着 `shadow-composer-focus` 这个变量在深色下没有独立价值。
3. **stagger 只覆盖前 5 项 + n+6 封顶**，未实现 §6 中 mention popup 的 18ms/8 项等其它档位——任务书只要求菜单 20ms 与 chip 40ms 两档。
4. **reduced-motion 对 transition 的压制用了选择器枚举**（.status-transition + Tailwind transition utilities），不是 `* { transition-duration: 1ms }` 全称覆盖；组件内使用的 `transition duration-150`（Button/SidebarItem）已被 `.transition` 命中，但未来新写的自定义 transition class 需要自觉挂进枚举。
5. **登录页玻璃卡下没有可模糊的内容**：画布是纯色，blur/saturate 视觉贡献有限（LiveAgent 的 composer 浮在 transcript 之上才出效果）。配方照抄了，但"玻璃感"要等阶段 4 有内容衬底后才能完全成立。
6. **窗口尺寸未动**：tauri.conf.json 仍为 800×600（视觉记忆记录 LiveAgent 为 1400×800 / min 1200×720）。改窗口不在本阶段任务书内，未擅动；272px 侧栏在 800 宽下偏挤，建议阶段 4 定夺。
7. **Sidebar wordmark 用纯文字**：侧栏顶部只放了 "PenguinHarness" 文字，没有放 logo 图——任务书只要求登录页放 logo，避免自作主张。

### 留阶段 4 验证

- TrendChart 真实图表接入（线色 --chat-running、点色 success/error、无渐变填充的规范已写入文件头注释）
- Overview 四张 StatCard 接真实评测数据；空态 "—" 与趋势小字的实数据形态
- surface ladder 五级在真实密度页面（工具轨迹、设置页）下的对比度验证
- 玻璃焦点 token 化迁移到 Run 配置 / 审批等"可行动焦点"（§7.3）
- 深浅主题截图评审（由主会话评审时补，包括 running 紫 / blocked 琥珀在小字号下的区分度实测）

## 三、提交清单

| 提交 | 内容 |
| --- | --- |
| tokens.css | §2.1 全量 token + §2.4 阴影变量 + surface ladder + @theme 接线 + 滚动条 |
| motion.css | 缓动/keyframes/stagger/状态过渡/reduced-motion |
| components | 九组件 + cn 助手 |
| theme.ts | 三态主题 + 持久化 + matchMedia |
| AppShell + Overview | 布局骨架 + 仪表盘占位（设计系统样板间） |
| logo | vendor 复制 + tauri icon 全套 |
| 套皮 | 登录玻璃卡 + Sessions 高密度行 + 路由重排 |
