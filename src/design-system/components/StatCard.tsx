import type { ReactNode } from "react";
import { cn } from "../cn";
import GlassCard from "./GlassCard";

export interface StatCardProps {
  label: string;
  /** null / undefined renders the empty state ("—"). */
  value?: string | number | null;
  /** Optional small trend line under the value, e.g. "+2.4 vs last run". */
  trend?: ReactNode;
  trendTone?: "up" | "down" | "neutral";
  /** Current high-priority metric; consumes the page's raised focus surface. */
  emphasis?: boolean;
  className?: string;
}

const trendToneClasses = {
  up: "text-[hsl(var(--chat-success))]",
  down: "text-[hsl(var(--chat-error))]",
  neutral: "text-muted-foreground",
} as const;

/*
 * Workbench stat tile — stage-3 upgrade (brief §7.2/7.4 direction).
 * Opaque by default: structural metrics belong to the raised surface tier,
 * not the glass tier. `emphasis` moves one metric to the focus surface with a
 * brighter rim. True blur/gloss remains centralized in GlassCard so a page
 * cannot accidentally make every tile glass.
 */
export default function StatCard({
  label,
  value,
  trend,
  trendTone = "neutral",
  emphasis = false,
  className,
}: StatCardProps) {
  const empty = value === null || value === undefined || value === "";
  const content = (
    <>
      <div className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground">
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
    </>
  );

  if (emphasis) {
    return (
      <GlassCard
        variant="focus"
        className={cn("min-h-[92px] px-4 py-3", className)}
      >
        {content}
      </GlassCard>
    );
  }

  return (
    <div
      className={cn(
        "min-h-[92px] rounded-xl border border-border/50 bg-surface-raised px-4 py-3 shadow-sm",
        className,
      )}
    >
      {content}
    </div>
  );
}
