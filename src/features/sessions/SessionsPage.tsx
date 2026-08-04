import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { logout } from "../../api/endpoints/auth";
import {
  listAgents,
  listProjects,
  listSessions,
} from "../../api/endpoints/sessions";
import type { SessionInfo, SessionStatus } from "../../api/types";
import {
  Button,
  SectionHeading,
  StatusBadge,
} from "../../design-system/components";
import type { BadgeStatus } from "../../design-system/components";
import { LogOutIcon } from "../../design-system/icons";

/** Server session states → badge semantics (idle rests gray, busy states pulse). */
const statusToBadge: Record<SessionStatus, { badge: BadgeStatus; label: string }> =
  {
    idle: { badge: "queued", label: "Idle" },
    running: { badge: "running", label: "Running" },
    compacting: { badge: "running", label: "Compacting" },
  };

/**
 * Sessions hang off a (project, agent) pair on the server — there is no global list.
 * This minimal takeover page walks projects -> agents and lists the first agent's sessions.
 */
export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { projects } = await listProjects();
        const project = projects[0];
        if (!project) {
          if (!cancelled) setSessions([]);
          return;
        }
        const { agents } = await listAgents(project.projectId);
        const agent = agents[0];
        if (!agent) {
          if (!cancelled) {
            setScope(project.projectId);
            setSessions([]);
          }
          return;
        }
        const { sessions: list } = await listSessions(
          project.projectId,
          agent.agentId,
        );
        if (!cancelled) {
          setScope(`${project.projectId} / ${agent.agentId}`);
          setSessions(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-12 pt-4">
      <header className="animate-section-in mb-6">
        <p className="font-mono text-[10px] font-medium tracking-[0.12em] text-muted-foreground/70">
          WORKSPACE / SESSIONS
        </p>
        <div className="flex items-center justify-between">
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            Sessions
          </h1>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOutIcon className="h-3.5 w-3.5" />
            退出登录
          </Button>
        </div>
        {scope && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{scope}</p>
        )}
      </header>

      <SectionHeading active className="animate-section-in mb-2">
        会话列表
      </SectionHeading>

      <div className="rounded-xl border border-border/50 bg-surface-panel/70 p-1 shadow-sm">
        {error && (
          <p className="px-3 py-6 text-center text-xs text-[hsl(var(--chat-error))]">
            {error}
          </p>
        )}
        {!error && sessions === null && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            加载中…
          </p>
        )}
        {sessions !== null && sessions.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            暂无会话 · 阶段 4 将支持创建会话
          </p>
        )}
        {sessions !== null && sessions.length > 0 && (
          <ul className="stagger-menu divide-y divide-border/40">
            {sessions.map((s) => {
              const st = statusToBadge[s.status];
              return (
                <li key={s.sessionId} className="animate-section-in p-1">
                  <button
                    type="button"
                    className="group flex min-h-[52px] w-full select-none items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-[background-color,border-color,transform] duration-150 ease-out hover:border-border/40 hover:bg-surface-raised active:translate-y-px focus:outline-none"
                  >
                    <span
                      aria-hidden
                      className="h-7 w-[2px] shrink-0 rounded-full bg-foreground/10 transition-colors duration-150 group-hover:bg-foreground/25"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground/90">
                        {s.title ?? "新对话"}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                        {s.sessionId} · {new Date(s.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <StatusBadge status={st.badge}>{st.label}</StatusBadge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
