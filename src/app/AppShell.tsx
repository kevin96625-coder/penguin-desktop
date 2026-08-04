import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BrandMark,
  Button,
  SidebarItem,
  StatusBadge,
} from "../design-system/components";
import {
  ChevronDownIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PencilIcon,
  SettingsIcon,
  SunIcon,
} from "../design-system/icons";
import { logout } from "../api/endpoints/auth";
import { useTheme, type ThemeMode } from "./theme";

const themeIcons: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

const themeTitles: Record<ThemeMode, string> = {
  light: "主题：浅色（点击切换为深色）",
  dark: "主题：深色（点击切换为跟随系统）",
  system: "主题：跟随系统（点击切换为浅色）",
};

/*
 * Layout constants from visual memory §3:
 *   sidebar 272px, collapses to w-0 + opacity-0 (no icon rail), 200ms ease-out
 *   top bar 52px; Tauri overlay folds the native macOS titlebar into it
 *   sidebar plane: --sidebar-bg, 1px border/50 divider
 */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { mode, cycle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ThemeIcon = themeIcons[mode];

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/*
       * Single integrated macOS titlebar. Tauri's Overlay style places the
       * native traffic lights above this 52px web surface, matching Codex's
       * one-bar composition instead of stacking a native bar and app header.
       */}
      <header
        data-tauri-drag-region
        className="flex h-[52px] shrink-0 border-b border-border/50"
      >
        <div
          data-tauri-drag-region
          className={`flex h-full shrink-0 items-center border-r border-border/50 bg-[hsl(var(--sidebar-bg))] transition-[width] duration-200 ease-out ${
            collapsed ? "w-[148px]" : "w-[272px]"
          }`}
        >
          {/* Native traffic-light safe zone; still draggable between buttons. */}
          <div data-tauri-drag-region className="h-full w-[104px] shrink-0" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-foreground/70 hover:bg-surface-raised"
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
          <div data-tauri-drag-region className="h-full min-w-3 flex-1" />
        </div>

        <div
          data-tauri-drag-region
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 bg-surface-panel px-3"
        >
          {/* Stage 3 context placeholders. Stage 4 binds route state + rename. */}
          <Button
            variant="ghost"
            size="sm"
            className="group h-8 min-w-0 max-w-[172px] justify-start gap-1.5 rounded-lg px-2 text-[12px] font-semibold tracking-tight hover:bg-surface-raised"
            title="当前 Agent：default_agent（阶段 4 接入重命名）"
          >
            <MessageSquareIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">default_agent</span>
            <PencilIcon className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors duration-150 group-hover:text-muted-foreground" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 max-w-[224px] justify-start gap-1.5 rounded-lg border border-border/50 bg-surface-raised px-2.5 font-mono text-[11px] font-medium text-foreground/75 shadow-rim hover:bg-surface-focus hover:text-foreground"
            title="当前模型：gemini-3.6-flash-high（阶段 4 接入模型列表）"
          >
            <span className="truncate">gemini-3.6-flash-high</span>
            <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>

          {/* Keep a generous native drag target between context and controls. */}
          <div data-tauri-drag-region className="h-full min-w-8 flex-1" />

          <StatusBadge status="idle" className="shrink-0">
            Idle
          </StatusBadge>
          <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-foreground/70 hover:bg-surface-raised"
            title="切换底部面板（阶段 4 开放）"
            aria-label="切换底部面板（阶段 4 开放）"
          >
            <PanelBottomIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-foreground/70 hover:bg-surface-raised"
            title="切换右侧面板（阶段 4 开放）"
            aria-label="切换右侧面板（阶段 4 开放）"
          >
            <PanelRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-foreground/70 hover:bg-surface-raised"
            title={themeTitles[mode]}
            onClick={cycle}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-foreground/70 hover:bg-surface-raised"
            title="设置（阶段 4 开放）"
            aria-label="设置（阶段 4 开放）"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`shrink-0 overflow-hidden border-r border-border/50 bg-[hsl(var(--sidebar-bg))] transition-[width,opacity] duration-200 ease-out ${
            collapsed ? "w-0 border-transparent opacity-0" : "w-[272px] opacity-100"
          }`}
        >
          {/* fixed inner width so content never squishes during the collapse */}
          <div className="flex h-full w-[272px] flex-col">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3">
              <BrandMark size="sm" />
              <span className="text-[13px] font-semibold tracking-tight text-foreground">
                PenguinHarness
              </span>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pt-3">
              <SidebarItem
                icon={<LayoutDashboardIcon />}
                active={pathname === "/"}
                onClick={() => navigate("/")}
              >
                Overview
              </SidebarItem>
              <SidebarItem
                icon={<MessageSquareIcon />}
                active={pathname.startsWith("/sessions")}
                onClick={() => navigate("/sessions")}
              >
                Sessions
              </SidebarItem>
            </nav>
            <div className="border-t border-border/40 px-2 pb-3 pt-2">
              <SidebarItem icon={<SettingsIcon />} disabled title="阶段 4 开放">
                Settings
              </SidebarItem>
              <SidebarItem
                icon={<LogOutIcon />}
                className="mt-0.5 text-muted-foreground hover:text-foreground"
                onClick={onLogout}
              >
                退出登录
              </SidebarItem>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
