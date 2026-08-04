import type { ReactNode } from "react";
import { cn } from "../cn";

export type BadgeStatus =
  | "idle"
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
  idle: "Idle",
  queued: "Queued",
  running: "Running",
  blocked: "Blocked",
  complete: "Complete",
  failed: "Failed",
};

function StatusGlyph({ status }: { status: BadgeStatus }) {
  const shared = "h-2.5 w-2.5 shrink-0 animate-status-glyph";

  if (status === "idle") {
    return (
      <svg aria-hidden viewBox="0 0 12 12" className={shared} fill="none">
        <circle cx="6" cy="6" r="2.25" fill="currentColor" fillOpacity="0.72" />
      </svg>
    );
  }

  if (status === "running") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className={cn(shared, "animate-status-spin")}
        fill="none"
      >
        <circle cx="6" cy="6" r="4" stroke="currentColor" strokeOpacity="0.28" />
        <path d="M6 2a4 4 0 0 1 4 4" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === "complete") {
    return (
      <svg aria-hidden viewBox="0 0 12 12" className={shared} fill="none">
        <path d="m2.5 6.2 2.1 2.1 4.9-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "blocked") {
    return (
      <svg aria-hidden viewBox="0 0 12 12" className={shared} fill="none">
        <rect x="3" y="2.5" width="2" height="7" rx="1" fill="currentColor" />
        <rect x="7" y="2.5" width="2" height="7" rx="1" fill="currentColor" />
      </svg>
    );
  }

  if (status === "failed") {
    return (
      <svg aria-hidden viewBox="0 0 12 12" className={shared} fill="none">
        <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden viewBox="0 0 12 12" className={shared} fill="none">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/*
 * Status badge — stage-3 upgrade (§7.6): low-alpha background + solid text +
 * state glyph, colors from the --status-* semantics in motion.css. The badge
 * box never moves: color/border cross-fade while the glyph settles in place;
 * only the running glyph rotates. This makes state changes traceable without
 * turning the dashboard into a field of pulsing dots.
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
        "status-transition inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium",
        className,
      )}
      style={{
        color,
        backgroundColor: `hsl(var(--status-${status}) / 0.1)`,
        borderColor: `hsl(var(--status-${status}) / 0.16)`,
      }}
    >
      <StatusGlyph key={status} status={status} />
      {children ?? statusLabels[status]}
    </span>
  );
}
