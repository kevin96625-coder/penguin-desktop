import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { login } from "../../api/endpoints/auth";
import { Button, Input } from "../../design-system/components";
import penguinLogo from "../../assets/penguin-logo.svg";

/*
 * Login card = the page's single glass focus object (§5 recipe):
 * 24px radius, blur 24px + saturate 165%, light face white/70 (focus .74),
 * dark face white/[0.06] (focus .08), double rim-light, inner gloss,
 * --shadow-composer → --shadow-composer-focus on focus-within.
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
        <div
          className={
            "animate-section-in relative w-full max-w-sm rounded-[24px] border p-8 " +
            "backdrop-blur-2xl backdrop-saturate-[1.65] " +
            /* light glass face + rim + composer shadow (§5) */
            "border-black/[0.055] bg-white/70 " +
            "shadow-[inset_0_1px_0_rgb(255_255_255/0.74),var(--shadow-composer)] " +
            "focus-within:border-black/[0.075] focus-within:bg-white/[0.74] " +
            "focus-within:shadow-[inset_0_1px_0_rgb(255_255_255/0.78),var(--shadow-composer-focus)] " +
            /* dark glass: edge定义交给白色 alpha，黑投影维持高吸收 */
            "dark:border-white/[0.10] dark:bg-white/[0.06] " +
            "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),var(--shadow-composer)] " +
            "dark:focus-within:border-white/[0.15] dark:focus-within:bg-white/[0.08] " +
            "dark:focus-within:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),var(--shadow-composer)]"
          }
        >
          {/* rim-light 第二层：顶部 1px 渐变线，左右各缩进 20px */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/15"
          />
          {/* 内部 gloss：white/.18 → 透明（深色 .04） */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[24px] bg-gradient-to-b from-white/[0.18] to-transparent dark:from-white/[0.04]"
          />

          <div className="relative">
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
          </div>
        </div>
      </div>
    </main>
  );
}
