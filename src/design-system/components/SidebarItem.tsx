import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn";

export interface SidebarItemProps extends ComponentProps<"button"> {
  active?: boolean;
  icon?: ReactNode;
  /** Indent level; each level adds left padding. */
  indent?: 0 | 1 | 2;
}

const indentClasses = ["pl-2", "pl-6", "pl-10"] as const;

/*
 * Visual memory §4 侧栏 item: ~30px rows, 8px radius, transparent at rest.
 * Hover/active are pure grayscale overlays (foreground alpha) — no hue is ever
 * introduced, and there is no left highlight bar in the sidebar itself.
 */
export default function SidebarItem({
  active = false,
  icon,
  indent = 0,
  className,
  children,
  type = "button",
  ...props
}: SidebarItemProps) {
  return (
    <button
      type={type}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[30px] w-full select-none items-center gap-2 rounded-lg pr-2 text-left text-[13px] font-medium",
        "transition-colors duration-150 ease-out",
        "focus:outline-none focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        indentClasses[indent],
        active
          ? "bg-foreground/[0.07] text-foreground hover:bg-foreground/[0.09]"
          : "text-foreground/85 hover:bg-foreground/[0.05]",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-foreground/70 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
    </button>
  );
}
