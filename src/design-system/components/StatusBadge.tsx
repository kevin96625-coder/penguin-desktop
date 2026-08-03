import type { ReactNode } from "react";
import { cn } from "../cn";

export type BadgeStatus =
  | "queued"
  | "running"
  | "blocked"
  | "complete"
  | "failed";

export interface StatusBadgeProps {
  status: BadgeStatus;
  /** Custom label; defaults to the status name. */
  children?: ReactNode;
  className?: string;
}

const statusLabels: Record<BadgeStatus, string> = {
  queued: "Queued",
  running: "Running",
  blocked: "Blocked",
  complete: "Complete",
  failed: "Failed",
};

/*
 * Status badge — stage-3 upgrade (§7.6): low-alpha background + solid text +
 * status dot, colors from the --status-* semantics in motion.css. The running
 * dot carries the restrained 1.6s pulse; the whole badge rides
 * .status-transition so state changes shift color, not position.
 */
export default function StatusBadge({
  status,
  children,
  className,
}: StatusBadgeProps) {
  const color = `hsl(var(--status-${status}))`;
  return (
    <span
      className={cn(
        "status-transition inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium",
        className,
      )}
      style={{
        color,
        backgroundColor: `hsl(var(--status-${status}) / 0.12)`,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          status === "running" && "animate-status-pulse",
        )}
        style={{ backgroundColor: color }}
      />
      {children ?? statusLabels[status]}
    </span>
  );
}
