import penguinLogo from "../../assets/penguin-logo.svg";
import { cn } from "../cn";

export interface BrandMarkProps {
  size?: "sm" | "lg";
  className?: string;
  decorative?: boolean;
}

const sizes = {
  sm: "h-7 w-7 rounded-lg p-0.5",
  lg: "h-14 w-14 rounded-xl p-0.5",
} as const;

/** Keep the logo's white artboard as an intentional enamel plate in both themes. */
export default function BrandMark({
  size = "sm",
  className,
  decorative = true,
}: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-black/[0.06] bg-white shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_7px_-3px_rgb(15_23_42/0.28)]",
        "dark:border-white/[0.14] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_5px_14px_-7px_rgb(0_0_0/0.85)]",
        sizes[size],
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
