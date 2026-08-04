import penguinLogo from "../../assets/penguin-logo.svg";
import { cn } from "../cn";

export interface BrandMarkProps {
  size?: "xs" | "sm" | "lg";
  className?: string;
  decorative?: boolean;
  /**
   * White enamel plate behind the artwork. On for hero placements (login card),
   * where the mark is the page's focus object. Off in dense chrome (the sidebar
   * rail): the logo's own dark artboard then sits straight on the surface, so a
   * bright plate can't outweigh the wordmark next to it.
   */
  plate?: boolean;
}

/** Plated geometry — unchanged from the original single-variant BrandMark. */
const plated = {
  xs: "h-[22px] w-[22px] rounded-[7px] p-0.5",
  sm: "h-7 w-7 rounded-lg p-0.5",
  lg: "h-14 w-14 rounded-xl p-0.5",
} as const;

/*
 * Bare geometry — no padding, so the artwork reaches the box edge. Radii track
 * the SVG's own rx (230 / 954 ≈ 24%) so the hairline rim hugs the artboard
 * instead of cutting across its corners.
 */
const bare = {
  xs: "h-[22px] w-[22px] rounded-[5px]",
  sm: "h-7 w-7 rounded-md",
  lg: "h-14 w-14 rounded-[13px]",
} as const;

export default function BrandMark({
  size = "sm",
  className,
  decorative = true,
  plate = true,
}: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        plate
          ? cn(
              "border border-black/[0.06] bg-white shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_7px_-3px_rgb(15_23_42/0.28)]",
              "dark:border-white/[0.14] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_5px_14px_-7px_rgb(0_0_0/0.85)]",
              plated[size],
            )
          : cn(
              // Rim only — enough definition for the dark artboard to read against
              // a dark rail, without the plate's brightness or drop shadow.
              "overflow-hidden ring-1 ring-inset ring-black/[0.08] dark:ring-white/[0.10]",
              bare[size],
            ),
        className,
      )}
    >
      <img
        src={penguinLogo}
        alt={decorative ? "" : "PenguinHarness"}
        aria-hidden={decorative || undefined}
        className="h-full w-full"
        draggable={false}
      />
    </span>
  );
}
