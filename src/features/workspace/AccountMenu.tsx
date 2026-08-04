import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/endpoints/auth";
import { Button } from "../../design-system/components";
import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "../../design-system/icons";
import { useTheme, type ThemeMode } from "../../app/theme";

const themeIcons: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

const themeLabels: Record<ThemeMode, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};

interface AccountMenuProps {
  onClose: () => void;
}

export default function AccountMenu({ onClose }: AccountMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { mode, cycle } = useTheme();
  const ThemeIcon = themeIcons[mode];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-account-trigger]")
      ) {
        return;
      }
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="animate-tool-expand-in absolute bottom-[54px] left-2 right-2 z-30 rounded-xl border border-border/60 bg-surface-modal p-1.5 shadow-popover"
    >
      <Button
        variant="ghost"
        className="h-8 w-full justify-start rounded-lg px-2 text-xs"
        role="menuitem"
        onClick={cycle}
      >
        <ThemeIcon className="h-4 w-4 text-muted-foreground" />
        主题
        <span className="ml-auto text-[11px] text-muted-foreground">{themeLabels[mode]}</span>
      </Button>
      <Button
        variant="ghost"
        className="h-8 w-full justify-start rounded-lg px-2 text-xs"
        role="menuitem"
        disabled
        title="下一轮接入"
      >
        <SettingsIcon className="h-4 w-4 text-muted-foreground" />
        设置
        <span className="ml-auto text-[10px] text-muted-foreground">下一轮</span>
      </Button>
      <div className="my-1 h-px bg-border/60" />
      <Button
        variant="ghost"
        className="h-8 w-full justify-start rounded-lg px-2 text-xs text-[hsl(var(--chat-error))] hover:text-[hsl(var(--chat-error))]"
        role="menuitem"
        onClick={onLogout}
      >
        <LogOutIcon className="h-4 w-4" />
        退出登录
      </Button>
    </div>
  );
}
