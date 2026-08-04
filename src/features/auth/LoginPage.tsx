import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { login } from "../../api/endpoints/auth";
import { BrandMark, Button, GlassCard, Input } from "../../design-system/components";
import { MonitorIcon, MoonIcon, SunIcon } from "../../design-system/icons";
import { useTheme, type ThemeMode } from "../../app/theme";

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
 * Login card = the page's single glass focus object. §5 recipe lives in
 * design-system GlassCard; variant="composer" = resting --shadow-composer
 * with focus-within upgrade (identical to the pre-refactor inline classes).
 */
export default function LoginPage() {
  const [userId, setUserId] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { mode, cycle } = useTheme();
  const ThemeIcon = themeIcons[mode];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(userId, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* macOS titlebar drag strip (38px, §3) — login has no AppShell */}
      <div data-tauri-drag-region className="h-[38px] shrink-0" />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-2.5 z-20 h-8 w-8 rounded-lg bg-surface-panel/65 text-foreground/70 hover:bg-surface-raised"
        title={themeTitles[mode]}
        onClick={cycle}
      >
        <ThemeIcon className="h-4 w-4" />
      </Button>

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <GlassCard
          variant="composer"
          className="animate-section-in w-full max-w-[370px] p-7"
        >
          <BrandMark size="lg" decorative={false} />
          <p className="mt-4 font-mono text-[10px] font-medium tracking-[0.12em] text-muted-foreground/70">
            LOCAL AGENT WORKSPACE
          </p>
          <h1 className="mt-1 text-base font-semibold tracking-tight">
            登录 PenguinHarness
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            连接本地 penguin 服务以进入工作台
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                用户名
              </span>
              <Input
                className="bg-background/50 dark:bg-white/[0.04]"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                密码
              </span>
              <Input
                className="bg-background/50 dark:bg-white/[0.04]"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <Button type="submit" disabled={submitting} className="mt-2 w-full">
              {submitting ? "登录中…" : "登录"}
            </Button>
            {error && (
              <p className="text-xs text-[hsl(var(--chat-error))]">{error}</p>
            )}
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
