import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { login } from "../../api/endpoints/auth";
import { Button, GlassCard, Input } from "../../design-system/components";
import penguinLogo from "../../assets/penguin-logo.svg";

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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {/* macOS titlebar drag strip (38px, §3) — login has no AppShell */}
      <div data-tauri-drag-region className="h-[38px] shrink-0" />

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <GlassCard
          variant="composer"
          className="animate-section-in w-full max-w-sm p-8"
        >
          <img
            src={penguinLogo}
            alt="PenguinHarness"
            className="h-14 w-14 rounded-xl"
            draggable={false}
          />
          <h1 className="mt-4 text-base font-semibold tracking-tight">
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
