import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, SidebarItem } from "../design-system/components";
import {
  LayoutDashboardIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  SettingsIcon,
  SunIcon,
} from "../design-system/icons";
import { useTheme, type ThemeMode } from "./theme";
import penguinLogo from "../assets/penguin-logo.svg";

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
 *   top bar ~52px (32px controls + py-2.5), macOS titlebar spacer 38px
 *   sidebar plane: --sidebar-bg, 1px border/50 divider
 */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { mode, cycle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ThemeIcon = themeIcons[mode];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`shrink-0 overflow-hidden border-r border-border/50 bg-[hsl(var(--sidebar-bg))] transition-[width,opacity] duration-200 ease-out ${
          collapsed ? "w-0 border-transparent opacity-0" : "w-[272px] opacity-100"
        }`}
      >
        {/* fixed inner width so content never squishes during the collapse */}
        <div className="flex h-full w-[272px] flex-col">
          {/* macOS titlebar spacer (38px) — traffic lights live here */}
          <div data-tauri-drag-region className="h-[38px] shrink-0" />
          <div className="flex items-center gap-2 px-4 pb-1 pt-1">
            <img
              src={penguinLogo}
              alt=""
              aria-hidden
              className="h-6 w-6 rounded-md"
              draggable={false}
            />
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
          <div className="px-2 pb-3">
            <SidebarItem icon={<SettingsIcon />} disabled title="阶段 4 开放">
              Settings
            </SidebarItem>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-tauri-drag-region
          className={`flex h-[52px] shrink-0 items-center gap-1 px-3 py-2.5 ${
            collapsed ? "pl-20" : ""
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-foreground/70"
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
          {/* drag region fills the middle of the bar */}
          <div data-tauri-drag-region className="h-full flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-foreground/70"
            title={themeTitles[mode]}
            onClick={cycle}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
