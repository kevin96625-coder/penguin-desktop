import { cn } from "../cn";

/*
 * TrendChart — Stage 3 PLACEHOLDER. No chart library is wired (stage 4 work);
 * this file fixes the props contract and the container's visual spec so the
 * real chart drops in without redesign.
 *
 * Style spec for the stage-4 implementation:
 *   - line color: hsl(var(--chat-running)) (the purple "running" semantic)
 *   - point markers: hsl(var(--chat-success)) / hsl(var(--chat-error)) by
 *     datum semantics; neutral points use the line color
 *   - NO gradient fill under the line — flat skeleton, LiveAgent restraint
 *   - grid lines: border token at /30; axis labels 11px muted-foreground
 *   - container: rounded-xl, border/50, surface-panel well (recessed, so the
 *     drawn line is the brightest thing inside)
 */
export interface TrendChartProps {
  points: { x: string | number; y: number }[];
  height?: number;
  emptyLabel?: string;
  className?: string;
}

export default function TrendChart({
  points,
  height = 160,
  emptyLabel = "暂无趋势数据",
  className,
}: TrendChartProps) {
  const empty = points.length === 0;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-surface-panel",
        className,
      )}
      style={{ height }}
    >
      {/* grid skeleton: three horizontal rules at border/30 */}
      <div className="pointer-events-none absolute inset-x-4 top-1/4 border-t border-border/30" />
      <div className="pointer-events-none absolute inset-x-4 top-2/4 border-t border-border/30" />
      <div className="pointer-events-none absolute inset-x-4 top-3/4 border-t border-border/30" />

      {empty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {/* flat placeholder line where the trend will live */}
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
      ) : (
        /* stage 4 replaces this with the real series renderer */
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            {points.length} 个数据点 · 图表渲染于阶段 4 接入
          </p>
        </div>
      )}
    </div>
  );
}
