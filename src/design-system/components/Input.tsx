import type { ComponentProps } from "react";
import { cn } from "../cn";

export type InputProps = ComponentProps<"input">;

/*
 * Visual memory §4 输入框: 36px / 6px radius / 1px --input border / 12px
 * horizontal padding / text-sm. Focus produces NO ring and NO border change
 * (globally cleared in tokens.css) — focus feeling is delegated to the outer
 * container via focus-within (see the login glass card).
 */
export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
