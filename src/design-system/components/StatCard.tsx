import type { ReactNode } from "react";
import { cn } from "../cn";

export interface StatCardProps {
  label: string;
  /** null / undefined renders the empty state ("—"). */
  value?: string | number | null;
  /** Optional small trend line under the value, e.g. "+2.4 vs last run". */
  trend?: ReactNode;
  trendTone?: "up" | "down" | "neutral";
  className?: string;
}

const trendToneClasses = {
  up: "text-[hsl(var(--chat-success))]",
  down: "text-[hsl(var(--chat-error))]",
  neutral: "text-muted-foreground",
} as const;

/*
 * Workbench stat tile — stage-3 upgrade (brief §7.2/7.4 direction).
 * A lightweight cut of the §5 glass focus recipe: light = white/70 + blur-xl
 * + rim; dark = white/[0.06] face + white/[0.10] border. No gloss layer, no
 * large throw — glass budget stays with true focus objects.
 */
export default function StatCard({
  label,
  value,
  trend,
  trendTone = "neutral",
  className,
}: StatCardProps) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 backdrop-blur-xl",
        "border-black/[0.055] bg-white/70 shadow-rim",
        "dark:border-white/[0.10] dark:bg-white/[0.06]",
        className,
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          empty ? "text-muted-foreground/60" : "text-foreground",
        )}
      >
        {empty ? "—" : value}
      </div>
      {trend && (
        <div className={cn("mt-0.5 text-xs", trendToneClasses[trendTone])}>
          {trend}
        </div>
      )}
    </div>
  );
}
