import { cn } from "../../design-system/cn";

export interface SparklineProps {
  /** Score series, oldest → newest. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Per-benchmark micro trend. Fixed pixel geometry (no viewBox distortion) so the stroke and
 * the end dot stay round; the domain is per-sparkline, which is the point — each capability
 * row shows its own shape, not a shared axis.
 */
export default function Sparkline({
  values,
  width = 92,
  height = 26,
  className,
}: SparklineProps) {
  const series = values.filter((v) => Number.isFinite(v));
  if (series.length === 0) {
    return (
      <span className={cn("inline-block text-[11px] text-muted-foreground/60", className)}>
        —
      </span>
    );
  }

  const pad = 3;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const xAt = (i: number) =>
    series.length === 1 ? width / 2 : pad + (i / (series.length - 1)) * (width - pad * 2);
  const yAt = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const last = series.length - 1;
  const rising = series.length > 1 && series[last] >= series[last - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-[hsl(var(--chat-running))]", className)}
      aria-hidden
    >
      {series.length > 1 && (
        <polyline
          points={series.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.75}
        />
      )}
      <circle
        cx={xAt(last)}
        cy={yAt(series[last])}
        r={2.5}
        fill={`hsl(var(--chat-${rising ? "success" : "error"}))`}
      />
    </svg>
  );
}
