import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { listAgents, listProjects } from "../../api/endpoints/sessions";
import { listAgentTraces } from "../../api/endpoints/traces";
import type { AgentSummary, AgentTracesResponse } from "../../api/types";
import { SectionHeading } from "../../design-system/components";
import { traceKey } from "./format";
import TraceDetail from "./TraceDetail";
import TraceTree, { type TraceSelection } from "./TraceTree";

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

interface Scope {
  projectId: string;
  agents: AgentSummary[];
}

/**
 * Read-only Trace browser.
 *
 * Traces hang off an Agent, so the page first walks projects -> agents (the same shape the
 * Sessions page uses; the server has no global trace list) and then drills date -> session ->
 * file. Viewing and downloading are the only actions: the server's import route is
 * deliberately not surfaced.
 */
export default function TracesPage() {
  const [scope, setScope] = useState<Scope | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const [traces, setTraces] = useState<AgentTracesResponse | null>(null);
  const [tracesError, setTracesError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TraceSelection | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { projects } = await listProjects();
        const project = projects[0];
        if (!project) {
          if (!cancelled) setScope({ projectId: "", agents: [] });
          return;
        }
        const { agents } = await listAgents(project.projectId);
        if (cancelled) return;
        setScope({ projectId: project.projectId, agents });
        setAgentId(agents[0]?.agentId ?? null);
      } catch (err) {
        if (!cancelled) setScopeError(message(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scope?.projectId || !agentId) return;
    let cancelled = false;
    setTraces(null);
    setTracesError(null);
    setSelection(null);
    listAgentTraces(scope.projectId, agentId)
      .then((res) => {
        if (!cancelled) setTraces(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) setTracesError(message(err));
      });
    return () => {
      cancelled = true;
    };
  }, [scope?.projectId, agentId]);

  const fileCount = useMemo(
    () =>
      (traces?.dates ?? []).reduce(
        (n, d) => n + d.sessions.reduce((m, s) => m + s.files.length, 0),
        0,
      ),
    [traces],
  );

  const selectedKey = selection ? traceKey(selection.sessionId, selection.index) : null;
  const noProject = scope !== null && scope.projectId === "";
  const noAgent = scope !== null && scope.projectId !== "" && scope.agents.length === 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-6 pb-6 pt-4">
      <header className="animate-section-in mb-4">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
          Traces
        </h1>
        <p className="mt-0.5 font-mono text-[11px] leading-5 text-muted-foreground">
          {scope?.projectId ? `${scope.projectId}${agentId ? ` / ${agentId}` : ""}` : "—"}
          {" · 只读记录"}
        </p>
      </header>

      {scopeError && (
        <p className="rounded-xl border border-border/50 bg-surface-panel/70 px-3 py-6 text-center text-xs text-[hsl(var(--chat-error))]">
          {scopeError}
        </p>
      )}

      {!scopeError && scope === null && (
        <p className="rounded-xl border border-border/50 bg-surface-panel/70 px-3 py-10 text-center text-sm text-muted-foreground">
          加载中…
        </p>
      )}

      {(noProject || noAgent) && (
        <p className="rounded-xl border border-border/50 bg-surface-panel/70 px-3 py-10 text-center text-sm text-muted-foreground">
          {noProject ? "暂无项目" : "该项目下暂无 Agent"}
        </p>
      )}

      {scope !== null && scope.agents.length > 1 && (
        <div className="animate-section-in mb-3 flex flex-wrap items-center gap-1.5">
          {scope.agents.map((a) => (
            <button
              key={a.agentId}
              type="button"
              onClick={() => setAgentId(a.agentId)}
              className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 focus:outline-none ${
                a.agentId === agentId
                  ? "border-border/60 bg-surface-raised text-foreground/90"
                  : "border-transparent text-muted-foreground hover:border-border/40 hover:bg-surface-raised"
              }`}
            >
              {a.name ?? a.agentId}
            </button>
          ))}
        </div>
      )}

      {scope !== null && agentId !== null && (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col">
            <div className="animate-section-in mb-2 flex items-center justify-between">
              <SectionHeading active>Trace 文件</SectionHeading>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
                {traces === null ? "—" : `${fileCount} FILES`}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/50 bg-surface-panel/70 p-2 shadow-sm">
              {tracesError && (
                <p className="px-2 py-6 text-center text-xs text-[hsl(var(--chat-error))]">
                  {tracesError}
                </p>
              )}
              {!tracesError && traces === null && (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                  加载中…
                </p>
              )}
              {!tracesError && traces !== null && traces.dates.length === 0 && (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                  该 Agent 暂无 Trace 记录
                </p>
              )}
              {!tracesError && traces !== null && traces.dates.length > 0 && (
                <TraceTree
                  key={`${scope.projectId}/${agentId}`}
                  dates={traces.dates}
                  selectedKey={selectedKey}
                  onSelect={setSelection}
                />
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-surface-panel/70 shadow-sm">
            {selection === null ? (
              <p className="px-4 py-16 text-center text-sm text-muted-foreground">
                {traces !== null && traces.dates.length === 0
                  ? "没有可查看的 Trace"
                  : "从左侧选择一个 Trace 文件以查看记录"}
              </p>
            ) : (
              <TraceDetail
                // Remount per file: paging and fetch state reset with the selection.
                key={`${scope.projectId}/${agentId}/${selectedKey}`}
                projectId={scope.projectId}
                agentId={agentId}
                sessionId={selection.sessionId}
                index={selection.index}
                sizeBytes={selection.sizeBytes}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
