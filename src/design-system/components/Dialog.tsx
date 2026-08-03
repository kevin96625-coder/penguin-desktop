import { useEffect, type ReactNode } from "react";
import { cn } from "../cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/*
 * Visual memory §4 Dialog: backdrop black/55 + blur-sm; panel rounded-2xl,
 * border/70, opaque bg-background carrying --shadow-modal (rim + 80px throw).
 * Entry: 180ms --ease-modal from translateY(12px) scale(.985) — see
 * .animate-modal-in in motion.css.
 */
export default function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="animate-backdrop-in absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-modal-in relative w-full max-w-md rounded-2xl border border-border/70 bg-background p-6 shadow-modal",
          className,
        )}
      >
        {title && (
          <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
