import type { ReactNode } from "react";
import { cn } from "../cn";

export interface SectionHeadingProps {
  children: ReactNode;
  /** Optional right-aligned action slot (buttons, links). */
  action?: ReactNode;
  /** Currently active workbench region: accent bar switches to primary. */
  active?: boolean;
  className?: string;
}

/*
 * Workbench section heading — stage-3 upgrade (§7.2): LiveAgent organizes
 * sections with quiet text-only titles; the workbench needs a stronger anchor
 * without getting loud. A 3px rounded grayscale bar (primary when the region
 * is active) gives the eye a fixed left edge; text stays text-sm semibold.
 */
export default function SectionHeading({
  children,
  action,
  active = false,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "h-3.5 w-[3px] shrink-0 rounded-full",
          active ? "bg-primary" : "bg-foreground/20",
        )}
      />
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}
