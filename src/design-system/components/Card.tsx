import type { ComponentProps } from "react";
import { cn } from "../cn";

type CardSurface = "card" | "canvas" | "panel" | "raised" | "focus" | "modal";

export interface CardProps extends ComponentProps<"div"> {
  /** Surface ladder level (§7.4); "card" = plain bg-card. */
  surface?: CardSurface;
  /** 12px by default; 16px for large cards. */
  radius?: "xl" | "2xl";
}

const surfaceClasses: Record<CardSurface, string> = {
  card: "bg-card text-card-foreground",
  canvas: "bg-surface-canvas",
  panel: "bg-surface-panel",
  raised: "bg-surface-raised",
  focus: "bg-surface-focus",
  modal: "bg-surface-modal",
};

/*
 * Visual memory §4 卡片: 12–16px radius, translucent border (border/40–70),
 * at most a faint rim — never a heavy shadow. Blur belongs to focus objects
 * only (StatCard / login card), not to every Card.
 */
export default function Card({
  surface = "card",
  radius = "xl",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        radius === "2xl" ? "rounded-2xl" : "rounded-xl",
        "border border-border/50",
        surfaceClasses[surface],
        className,
      )}
      {...props}
    />
  );
}
