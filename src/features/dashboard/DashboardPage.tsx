import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { listBenchmarks } from "../../api/endpoints/benchmarks";
import { listAgents } from "../../api/endpoints/sessions";
import type { AgentSummary, BenchmarkSummary } from "../../api/types";
import {
  Button,
  GlassCard,
  SectionHeading,
  StatCard,
  StatusBadge,
  TrendChart,
} from "../../design-system/components";
import { FlaskIcon } from "../../design-system/icons";
import { useChat } from "../chat/ChatProvider";
import AgentSelect from "./AgentSelect";
import Sparkline from "./Sparkline";
import {
  buildEvolution,
  formatCost,
  formatDelta,
  formatDuration,
  formatScore,
  formatTime,
  latestEvaluationOf,
  scoreSeries,
} from "./evolution-metrics";

const errText = (err: unknown) =>
  err instanceof ApiError ? err.message : String(err);

/** Signed round-over-round change. Direction is the whole point, so the arrow leads. */
function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-border/60 px-2.5 py-1 text-[12px] text-muted-foreground">
        首轮评测
      </span>
    );
  }
  const tone =
    delta > 0 ? "--chat-success" : delta < 0 ? "--chat-error" : "--chat-running";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums"
      style={{
        color: `hsl(var(${tone}))`,
        borderColor: `hsl(var(${tone}) / 0.24)`,
        backgroundColor: `hsl(var(${tone}) / 0.1)`,
      }}
    >
      <span aria-hidden>{delta > 0 ? "↑" : delta < 0 ? "↓" : "→"}</span>
      {formatDelta(delta)}
      <span className="font-normal opacity-70">较上一版本</span>
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px] text-foreground/85">{value}</span>
    </div>
  );
}

/**
 * Self-evolution dashboard — the signature page.
 *
 * Scope is one agent: benchmark data is isolated per agent, and the version shown is the
 * *Agent State* version under test, never the PenguinHarness tool version. Everything is
 * derived from `GET .../benchmarks` (read-only, no SSE — the stream budget belongs to Chat).
 */
export default function DashboardPage() {
  const { ready, projectId, agentId: sessionAgentId, error: chatError } = useChat();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [pickedAgentId, setPickedAgentId] = useState<string | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than seeded into state: the chat singleton is the default until the user
  // explicitly picks another agent, and it may still be resolving on first render.
  const agentId = pickedAgentId ?? sessionAgentId;

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    listAgents(projectId)
      .then((res) => {
        if (!cancelled) setAgents(res.agents);
      })
      .catch(() => {
        // A failed agent list only costs the switcher; the page still renders one agent.
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !agentId) return;
    let cancelled = false;
    setBenchmarks(null);
    setError(null);
    listBenchmarks(projectId, agentId)
      .then((res) => {
        if (!cancelled) setBenchmarks(res.benchmarks);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId]);

  const metrics = useMemo(() => buildEvolution(benchmarks ?? []), [benchmarks]);
  const trendPoints = useMemo(
    () =>
      metrics.points.map((p) => ({
        x: `v${p.version}`,
        y: p.score,
        hint: formatTime(p.time),
      })),
    [metrics.points],
  );

  // No agentId means the fetch never started — that is a terminal state, not loading.
  const loading =
    !ready || (agentId !== null && benchmarks === null && error === null);
  const latest = metrics.latest;
  const empty = benchmarks !== null && benchmarks.length === 0;

  const header = (
    <header className="animate-section-in mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-foreground">
          自进化
        </h1>
        <p className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-muted-foreground">
          当前 Agent 在自身 benchmark 上的演进轨迹 · 版本指 Agent State 版本
        </p>
      </div>
      <AgentSelect
        agents={agents}
        value={agentId}
        onChange={(next) => setPickedAgentId(next)}
        disabled={!ready}
      />
    </header>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 pb-14 pt-4">
        {header}

        {(chatError || error) && (
          <p className="animate-section-in mb-5 rounded-lg border border-[hsl(var(--chat-error))]/40 px-3 py-2 text-[12px] text-[hsl(var(--chat-error))]">
            {chatError ?? error}
          </p>
        )}

        {loading && !error && (
          <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
        )}

        {!loading && ready && !agentId && !error && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            当前 Project 下没有可用的 Agent。
          </p>
        )}

        {!loading && empty && (
          <GlassCard variant="focus" className="animate-section-in px-8 py-14">
            <div className="mx-auto flex max-w-[42ch] flex-col items-center text-center">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-surface-raised">
                <FlaskIcon className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-[14px] leading-6 text-foreground/90">
                这个 agent 还没有 benchmark 评估。创建第一个 benchmark 开始自进化。
              </p>
              <Button className="mt-5" onClick={() => navigate("/benchmarks")}>
                创建 Benchmark
              </Button>
            </div>
          </GlassCard>
        )}

        {!loading && benchmarks !== null && benchmarks.length > 0 && (
          <>
            {/* Hero: the one number the product is about, plus its round-over-round move. */}
            <GlassCard
              variant="focus"
              className="animate-section-in mb-6 px-6 py-6 sm:px-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
                    综合分
                  </div>
                  <div className="mt-1 flex items-end gap-3">
                    <span className="text-[64px] font-semibold leading-[1.02] tracking-[-0.035em] tabular-nums text-foreground">
                      {metrics.composite === null ? "—" : formatScore(metrics.composite)}
                    </span>
                    <span className="pb-3 text-[13px] text-muted-foreground">/ 100</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <DeltaPill delta={metrics.delta} />
                    <StatusBadge status={metrics.version === null ? "idle" : "complete"}>
                      {metrics.version === null ? "未评测" : `v${metrics.version}`}
                    </StatusBadge>
                  </div>
                </div>

                {latest && (
                  <div className="w-full min-w-[210px] max-w-[280px] space-y-1.5 sm:w-auto">
                    <MetaRow label="模型" value={latest.evaluation.modelId} />
                    <MetaRow label="Provider" value={latest.evaluation.provider} />
                    <MetaRow label="思考等级" value={latest.evaluation.thinkingLevel} />
                    <MetaRow label="最近评测" value={formatTime(latest.evaluation.time)} />
                  </div>
                )}
              </div>
            </GlassCard>

            <section className="animate-section-in mb-7" style={{ animationDelay: "40ms" }}>
              <div className="stagger-chip grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <StatCard
                  className="animate-section-in"
                  label="综合分"
                  value={metrics.composite === null ? null : formatScore(metrics.composite)}
                  trend={
                    metrics.delta === null ? "首轮评测" : `${formatDelta(metrics.delta)} 较上一版本`
                  }
                  trendTone={
                    metrics.delta === null || metrics.delta === 0
                      ? "neutral"
                      : metrics.delta > 0
                        ? "up"
                        : "down"
                  }
                  emphasis
                />
                <StatCard
                  className="animate-section-in"
                  label="本轮提升"
                  value={metrics.delta === null ? null : formatDelta(metrics.delta)}
                  trend={`共 ${metrics.points.length} 个版本`}
                  trendTone={
                    metrics.delta === null || metrics.delta === 0
                      ? "neutral"
                      : metrics.delta > 0
                        ? "up"
                        : "down"
                  }
                />
                <StatCard
                  className="animate-section-in"
                  label="总成本"
                  value={metrics.totalCost === null ? null : formatCost(metrics.totalCost)}
                  trend={`${metrics.evaluationCount} 次评测累计`}
                />
                <StatCard
                  className="animate-section-in"
                  label="当前版本"
                  value={metrics.version === null ? null : `v${metrics.version}`}
                  trend={
                    latest ? `单轮耗时 ${formatDuration(latest.evaluation.durationMs)}` : undefined
                  }
                />
              </div>
            </section>

            <section className="animate-section-in mb-7" style={{ animationDelay: "80ms" }}>
              <SectionHeading
                active
                className="mb-3"
                action={
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
                    {metrics.points.length} ROUNDS
                  </span>
                }
              >
                评分趋势
              </SectionHeading>
              <TrendChart
                points={trendPoints}
                height={228}
                emptyLabel="运行首次评测后展示趋势"
              />
            </section>

            {latest && (latest.evaluation.summaryTitle || latest.evaluation.summary) && (
              <section className="animate-section-in mb-7" style={{ animationDelay: "120ms" }}>
                <SectionHeading className="mb-3">最新改进</SectionHeading>
                <GlassCard variant="panel" className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium leading-6 text-foreground">
                      {latest.evaluation.summaryTitle ?? "本轮评测"}
                    </span>
                    <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      v{latest.evaluation.version} · {latest.benchmark.title}
                    </span>
                  </div>
                  {latest.evaluation.summary && (
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">
                      {latest.evaluation.summary}
                    </p>
                  )}
                </GlassCard>
              </section>
            )}

            {/* Capability dimensions only make sense once there is more than one axis. */}
            {benchmarks.length > 1 && (
              <section className="animate-section-in" style={{ animationDelay: "160ms" }}>
                <SectionHeading className="mb-3">能力维度</SectionHeading>
                <div className="overflow-hidden rounded-xl border border-border/50 bg-surface-panel/70">
                  <ul className="stagger-menu divide-y divide-border/40">
                    {benchmarks.map((benchmark) => {
                      const newest = latestEvaluationOf(benchmark);
                      const series = scoreSeries(benchmark);
                      return (
                        <li
                          key={benchmark.id}
                          className="animate-section-in flex items-center gap-4 px-4 py-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground/90">
                              {benchmark.title}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                              {benchmark.id} · {benchmark.caseCount} cases ·{" "}
                              {benchmark.evaluations.length} evals
                            </span>
                          </span>
                          <Sparkline values={series} className="shrink-0" />
                          <span className="w-14 shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground">
                            {newest ? formatScore(newest.score) : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
