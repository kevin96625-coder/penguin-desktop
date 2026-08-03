import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { logout } from "../../api/endpoints/auth";
import {
  listAgents,
  listProjects,
  listSessions,
} from "../../api/endpoints/sessions";
import type { SessionInfo } from "../../api/types";

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
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">会话列表</h1>
        <button
          onClick={onLogout}
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        >
          退出登录
        </button>
      </div>
      {scope && <p className="mb-4 text-sm text-gray-500">{scope}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && sessions === null && (
        <p className="text-sm text-gray-500">加载中…</p>
      )}
      {sessions !== null && sessions.length === 0 && (
        <p className="text-sm text-gray-500">暂无会话</p>
      )}
      {sessions !== null && sessions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.sessionId} className="rounded border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.title ?? "新对话"}</span>
                <span className="text-xs text-gray-500">{s.status}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {s.sessionId} · {new Date(s.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
