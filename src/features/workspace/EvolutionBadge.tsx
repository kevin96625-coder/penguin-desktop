import { useEffect, useState } from "react";
import { listBenchmarks } from "../../api/endpoints/benchmarks";
import type { BenchmarkEvaluation } from "../../api/types";

/**
 * Lightweight evolution state for the sidebar's current agent: version chip + score
 * trend arrow. Self-evolution is the product's signature, so it gets a presence in the
 * chrome rather than living only on the dashboard.
 *
 * Deliberately cheap: one benchmarks GET per (project, agent), no SSE, no polling — the
 * scoreboard only changes when an optimization round is appended, which is not a live
 * event on this surface. Renders nothing at all when the agent has no evaluations, so an
 * un-benchmarked agent shows no chrome noise.
 */
export default function EvolutionBadge({
  projectId,
  agentId,
}: {
  projectId: string | null;
  agentId: string | null;
}) {
  const [latest, setLatest] = useState<BenchmarkEvaluation | null>(null);
  const [previous, setPrevious] = useState<BenchmarkEvaluation | null>(null);

  useEffect(() => {
    if (!projectId || !agentId) return;
    let cancelled = false;
    listBenchmarks(projectId, agentId)
      .then((res) => {
        if (cancelled) return;
        // Across all benchmarks, the newest evaluation wins the chip; `evaluations` is
        // append-ordered so the tail is the most recent round.
        let best: BenchmarkEvaluation | null = null;
        let prev: BenchmarkEvaluation | null = null;
        for (const b of res.benchmarks) {
          const evals = b.evaluations;
          if (evals.length === 0) continue;
          const last = evals[evals.length - 1];
          if (!best || last.time > best.time) {
            best = last;
            prev = evals.length > 1 ? evals[evals.length - 2] : null;
          }
        }
        setLatest(best);
        setPrevious(prev);
      })
      .catch(() => {
        // A missing/unreadable scoreboard is not worth a sidebar error state.
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agentId]);

  if (!latest) return null;

  const delta = previous ? latest.score - previous.score : null;
  const rising = delta !== null && delta > 0;
  const falling = delta !== null && delta < 0;
  const tone = rising
    ? "--status-complete"
    : falling
      ? "--status-failed"
      : "--status-queued";

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
        v{latest.version}
      </span>
      {delta !== null && delta !== 0 && (
        <span
          className="font-mono text-[9px]"
          style={{ color: `hsl(var(${tone}))` }}
          title={`较上一轮 ${rising ? "+" : ""}${delta.toFixed(1)} 分`}
        >
          {rising ? "↑" : "↓"}
          {Math.abs(delta).toFixed(0)}
        </span>
      )}
    </span>
  );
}
