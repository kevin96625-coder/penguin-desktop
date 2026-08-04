import { cn } from "../cn";

/*
 * TrendChart — score series renderer (stage 4: real data wired).
 *
 * Draws the line itself instead of pulling in a chart library: the series this app shows is
 * a handful of evaluation rounds on a fixed 0..100 scale, so a dependency would cost more
 * than it saves. Geometry is percentage-based (no measurement, no ResizeObserver), which is
 * why the line lives in a distorting viewBox with a non-scaling stroke while the round
 * markers are positioned elements — circles inside that viewBox would come out as ellipses.
 *
 * Style spec (unchanged from the stage-3 container contract):
 *   - line color: hsl(var(--chat-running)) (the purple "running" semantic)
 *   - point markers: hsl(var(--chat-success)) / hsl(var(--chat-error)) by
 *     datum semantics — here, each step's direction against the previous point;
 *     the first point, and any flat step, uses the line color
 *   - NO gradient fill under the line — flat skeleton, LiveAgent restraint
 *   - grid lines: border token at /30; axis labels 11px muted-foreground
 *   - container: rounded-xl, border/50, surface-panel well (recessed, so the
 *     drawn line is the brightest thing inside)
 */

export interface TrendChartPoint {
  /** Axis label, e.g. "v3". */
  x: string | number;
  /** Value on the fixed 0..100 scale. */
  y: number;
  /** Extra tooltip text (time, sample count…), appended to the marker's title. */
  hint?: string;
}

export interface TrendChartProps {
  points: TrendChartPoint[];
  height?: number;
  emptyLabel?: string;
  className?: string;
}

const shell =
  "relative overflow-hidden rounded-xl border border-border/50 bg-surface-panel";

/* Horizontal inset of the first/last marker inside the plot box, in percent — without it
 * the edge markers would be clipped in half by the container. */
const EDGE = 6;
const TICK_STEPS = [5, 10, 20, 25, 50];

interface Domain {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * Pad the observed range by 10 on both sides, clamp to the valid 0..100 interval, then round
 * outward to human-friendly ticks.
 *
 * WHY autoscale rather than pin the axis to 0..100: this chart exists to show that a score
 * moved, and three rounds at 60 → 75 → 85 read as a nearly flat line against a hard 0..100
 * axis — the exact signal the self-evolution page is built to surface. The tick labels are
 * always drawn, so a non-zero baseline is stated rather than implied.
 */
function scoreDomain(values: number[]): Domain {
  const present = values.filter((v) => Number.isFinite(v) && v >= 0 && v <= 100);
  if (present.length === 0) return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };

  const paddedMin = Math.max(0, Math.min(...present) - 10);
  const paddedMax = Math.min(100, Math.max(...present) + 10);
  const step =
    TICK_STEPS.find((s) => (paddedMax - paddedMin) / s <= 4) ??
    TICK_STEPS[TICK_STEPS.length - 1];
  const min = Math.max(0, Math.floor(paddedMin / step) * step);
  const max = Math.min(100, Math.ceil(paddedMax / step) * step);
  const span = Math.max(step, max - min);
  const ticks: number[] = [];
  for (let v = min; v <= max + 0.001; v += step) ticks.push(Math.round(v));
  return { min, max: min + span, ticks };
}

export default function TrendChart({
  points,
  height = 160,
  emptyLabel = "暂无趋势数据",
  className,
}: TrendChartProps) {
  if (points.length === 0) {
    return (
      <div className={cn(shell, className)} style={{ height }}>
        {/* grid skeleton: three horizontal rules at border/30 */}
        <div className="pointer-events-none absolute inset-x-4 top-1/4 border-t border-border/30" />
        <div className="pointer-events-none absolute inset-x-4 top-2/4 border-t border-border/30" />
        <div className="pointer-events-none absolute inset-x-4 top-3/4 border-t border-border/30" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {/* empty-state decoration: a flat stand-in where the series would be drawn */}
          <svg
            width="120"
            height="12"
            viewBox="0 0 120 12"
            className="text-[hsl(var(--chat-running))] opacity-40"
            aria-hidden
          >
            <line
              x1="0"
              y1="6"
              x2="120"
              y2="6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="60" cy="6" r="2.5" fill="currentColor" />
          </svg>
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  const domain = scoreDomain(points.map((p) => p.y));
  const span = domain.max - domain.min || 1;
  const xAt = (i: number) =>
    points.length === 1 ? 50 : EDGE + (i / (points.length - 1)) * (100 - EDGE * 2);
  const yAt = (v: number) => 100 - ((v - domain.min) / span) * 100;

  const lastIndex = points.length - 1;

  return (
    <div
      className={cn(shell, className)}
      style={{ height }}
      role="img"
      aria-label={points.map((p) => `${p.x} ${p.y}`).join("、")}
    >
      {/* y axis gutter */}
      <div className="pointer-events-none absolute bottom-7 left-0 top-4 w-9">
        {domain.ticks.map((t) => (
          <span
            key={t}
            className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground/80"
            style={{ top: `${yAt(t)}%` }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* plot area */}
      <div className="absolute bottom-7 left-9 right-4 top-4">
        {domain.ticks.map((t) => (
          <div
            key={t}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-border/30"
            style={{ top: `${yAt(t)}%` }}
          />
        ))}

        <svg
          className="absolute inset-0 h-full w-full overflow-visible text-[hsl(var(--chat-running))]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* non-scaling-stroke keeps a true 1.75px line under the distorting viewBox */}
          {points.length > 1 && (
            <polyline
              points={points.map((p, i) => `${xAt(i)},${yAt(p.y)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {points.map((p, i) => {
          const prev = i > 0 ? points[i - 1].y : null;
          const tone =
            prev === null || p.y === prev
              ? "var(--chat-running)"
              : p.y > prev
                ? "var(--chat-success)"
                : "var(--chat-error)";
          return (
            <div
              key={`${p.x}-${i}`}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[hsl(var(--surface-panel))]"
              style={{
                left: `${xAt(i)}%`,
                top: `${yAt(p.y)}%`,
                backgroundColor: `hsl(${tone})`,
              }}
              title={p.hint ? `${p.x} · ${p.y} · ${p.hint}` : `${p.x} · ${p.y}`}
            />
          );
        })}

        {/* value tag on the newest datum only — the number the page is actually about */}
        <span
          className="absolute -translate-x-1/2 -translate-y-[190%] rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground shadow-sm"
          style={{ left: `${xAt(lastIndex)}%`, top: `${yAt(points[lastIndex].y)}%` }}
        >
          {points[lastIndex].y}
        </span>
      </div>

      {/* x axis */}
      <div className="absolute bottom-2 left-9 right-4 h-4">
        {points.map((p, i) => (
          <span
            key={`${p.x}-x-${i}`}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/80"
            style={{ left: `${xAt(i)}%` }}
          >
            {p.x}
          </span>
        ))}
      </div>
    </div>
  );
}
