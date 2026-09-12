import { Crown } from "lucide-react";

export type ProIndicatorVariant = "default" | "locked" | "active";

export type ProIndicatorSize = "default" | "compact";

interface ProIndicatorProps {
  /** Visual treatment. Locked is for free users on gated options; active for Pro subscribers. */
  variant?: ProIndicatorVariant;
  /** compact = crown only with accessible label */
  size?: ProIndicatorSize;
  className?: string;
  title?: string;
}

/**
 * Scanonix Pro capability marker: Crown + PRO (or crown-only when compact).
 * Does not implement entitlement — callers control locked option behavior separately.
 */
export function ProIndicator({
  variant = "default",
  size = "default",
  className = "",
  title = "Pro feature",
}: ProIndicatorProps) {
  const tone =
    variant === "locked"
      ? "border-scanonix-orange/30 bg-scanonix-orange/10 text-scanonix-orange opacity-90"
      : "border-scanonix-orange/35 bg-scanonix-orange/15 text-scanonix-orange";

  if (size === "compact") {
    return (
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${tone} ${className}`.trim()}
        title={title}
        aria-label={title}
      >
        <Crown className="h-3 w-3" aria-hidden="true" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span
      className={`pro-indicator inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 ${tone} ${className}`.trim()}
      title={title}
      aria-label={title}
    >
      <Crown className="h-3 w-3" aria-hidden="true" strokeWidth={2.25} />
      <span className="text-[10px] font-bold uppercase tracking-wide">Pro</span>
    </span>
  );
}
