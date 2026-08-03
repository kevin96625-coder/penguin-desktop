import type { JSX, ReactNode } from "react";
import { cn } from "../cn";

export type GlassCardVariant = "composer" | "focus" | "panel";

export interface GlassCardProps {
  /** Rendered element, default "div". */
  as?: keyof JSX.IntrinsicElements;
  /**
   * Shadow/face tier (§5):
   *   composer — resting --shadow-composer, upgrades face/rim/shadow on
   *              focus-within (the LoginPage / composer behavior)
   *   focus    — statically pinned at the focus-within tier
   *              (--shadow-composer-focus face + shadow, no transition)
   *   panel    — lighter floating tier (--shadow-popover), for popover-like
   *              glass surfaces
   */
  variant?: GlassCardVariant;
  className?: string;
  children?: ReactNode;
}

/*
 * §5 glass recipe, single source of truth (do not inline elsewhere):
 * 24px radius, blur 24px + saturate 165%,
 * light face white/70 (focus .74) + border black/[0.055] (focus .075),
 * dark face white/[0.06] (focus .08) + border white/[0.10] (focus .15),
 * double rim-light (full-card inset highlight + top 1px gradient line
 * inset-x-5), inner gloss gradient, --shadow-composer ladder.
 * Dark focus-within keeps --shadow-composer: per visual memory §5, dark-mode
 * focus is carried by border/background alpha, not the shadow.
 */
const base =
  "relative rounded-[24px] border backdrop-blur-2xl backdrop-saturate-[1.65]";

const variantClasses: Record<GlassCardVariant, string> = {
  composer:
    /* light glass face + rim + composer shadow (§5) */
    "border-black/[0.055] bg-white/70 " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.74),var(--shadow-composer)] " +
    "focus-within:border-black/[0.075] focus-within:bg-white/[0.74] " +
    "focus-within:shadow-[inset_0_1px_0_rgb(255_255_255/0.78),var(--shadow-composer-focus)] " +
    /* dark glass: edge定义交给白色 alpha，黑投影维持高吸收 */
    "dark:border-white/[0.10] dark:bg-white/[0.06] " +
    "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),var(--shadow-composer)] " +
    "dark:focus-within:border-white/[0.15] dark:focus-within:bg-white/[0.08] " +
    "dark:focus-within:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),var(--shadow-composer)]",
  focus:
    "border-black/[0.075] bg-white/[0.74] " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.78),var(--shadow-composer-focus)] " +
    "dark:border-white/[0.15] dark:bg-white/[0.08] " +
    "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),var(--shadow-composer)]",
  panel:
    "border-black/[0.055] bg-white/70 " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.74),var(--shadow-popover)] " +
    "dark:border-white/[0.10] dark:bg-white/[0.06] " +
    "dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),var(--shadow-popover)]",
};

export default function GlassCard({
  as: Tag = "div",
  variant = "composer",
  className,
  children,
}: GlassCardProps) {
  return (
    <Tag className={cn(base, variantClasses[variant], className)}>
      {/* rim-light 第二层：顶部 1px 渐变线，左右各缩进 20px */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-5 right-5 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/15"
      />
      {/* 内部 gloss：white/.18 → 透明（深色 .04）。rounded-t 跟默认 24px 圆角；
          如经 className 覆盖圆角，gloss 圆角需同步覆盖（暂无此用例）。 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-[24px] bg-gradient-to-b from-white/[0.18] to-transparent dark:from-white/[0.04]"
      />
      <div className="relative">{children}</div>
    </Tag>
  );
}
