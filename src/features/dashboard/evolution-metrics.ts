import type { BenchmarkEvaluation, BenchmarkSummary } from "../../api/types";

/** One evolution round: everything the agent scored while running Agent State `version`. */
export interface EvolutionPoint {
  version: number;
  /** caseCount-weighted mean of that round's benchmark scores, 0..100. */
  score: number;
  /** Newest evaluation time inside the round (ISO 8601). */
  time: string;
  /** How many benchmark evaluations were folded into this round. */
  sampleCount: number;
}

export interface LatestEvaluation {
  benchmark: BenchmarkSummary;
  evaluation: BenchmarkEvaluation;
}

export interface EvolutionMetrics {
  /** Oldest → newest. Empty when the agent has never been evaluated. */
  points: EvolutionPoint[];
  /** Newest round's score. */
  composite: number | null;
  /** Newest round minus the previous round; null when there is nothing to compare against. */
  delta: number | null;
  /** Sum of every known evaluation cost; null when no evaluation reported one. */
  totalCost: number | null;
  /** Agent State version of the newest round. */
  version: number | null;
  /** Newest evaluation across all benchmarks — the source of the "latest improvement" copy. */
  latest: LatestEvaluation | null;
  /** Total evaluation rounds recorded across all benchmarks. */
  evaluationCount: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** `evaluations[]` arrives in append order (oldest first), so the newest is the tail. */
export function latestEvaluationOf(
  benchmark: BenchmarkSummary,
): BenchmarkEvaluation | null {
  return benchmark.evaluations[benchmark.evaluations.length - 1] ?? null;
}

/** Score series of one benchmark, oldest → newest (feeds the per-benchmark sparkline). */
export function scoreSeries(benchmark: BenchmarkSummary): number[] {
  return benchmark.evaluations
    .map((e) => e.score)
    .filter((s) => typeof s === "number" && Number.isFinite(s));
}

/**
 * The dashboard headline is agent-level, but scores are recorded per benchmark. Rounds are
 * therefore keyed by the Agent State `version` under test — the one axis every benchmark of
 * an agent shares — and benchmarks inside a round are averaged weighted by caseCount, so a
 * 20-case benchmark carries more weight than a 2-case smoke test.
 */
export function buildEvolution(
  benchmarks: BenchmarkSummary[],
): EvolutionMetrics {
  const rounds = new Map<
    number,
    { weighted: number; weight: number; time: string; sampleCount: number }
  >();
  let costSum = 0;
  let costKnown = false;
  let evaluationCount = 0;
  let latest: LatestEvaluation | null = null;

  for (const benchmark of benchmarks) {
    const weight = Math.max(1, benchmark.caseCount);
    for (const evaluation of benchmark.evaluations) {
      evaluationCount += 1;
      if (typeof evaluation.cost === "number" && Number.isFinite(evaluation.cost)) {
        costSum += evaluation.cost;
        costKnown = true;
      }
      if (isNewer(evaluation, latest?.evaluation)) latest = { benchmark, evaluation };

      if (!Number.isFinite(evaluation.score)) continue;
      const round = rounds.get(evaluation.version) ?? {
        weighted: 0,
        weight: 0,
        time: evaluation.time,
        sampleCount: 0,
      };
      round.weighted += evaluation.score * weight;
      round.weight += weight;
      round.sampleCount += 1;
      if (evaluation.time > round.time) round.time = evaluation.time;
      rounds.set(evaluation.version, round);
    }
  }

  const points: EvolutionPoint[] = [...rounds.entries()]
    .map(([version, r]) => ({
      version,
      score: round1(r.weighted / r.weight),
      time: r.time,
      sampleCount: r.sampleCount,
    }))
    .sort((a, b) => a.version - b.version);

  const last = points[points.length - 1] ?? null;
  const prev = points[points.length - 2] ?? null;

  return {
    points,
    composite: last ? last.score : null,
    delta: last && prev ? round1(last.score - prev.score) : null,
    totalCost: costKnown ? costSum : null,
    version: last ? last.version : null,
    latest,
    evaluationCount,
  };
}

/** Time is the primary order; version breaks ties when two records share a timestamp. */
function isNewer(
  candidate: BenchmarkEvaluation,
  current: BenchmarkEvaluation | undefined,
): boolean {
  if (!current) return true;
  if (candidate.time !== current.time) return candidate.time > current.time;
  return candidate.version > current.version;
}

// --- display formatting ----------------------------------------------------

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function formatDelta(delta: number): string {
  const body = formatScore(Math.abs(delta));
  return delta > 0 ? `+${body}` : delta < 0 ? `-${body}` : body;
}

/** Evaluation costs are fractions of a dollar, so small values keep four decimals. */
export function formatCost(cost: number): string {
  return `$${cost < 1 ? cost.toFixed(4) : cost.toFixed(2)}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}min`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
