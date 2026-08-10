import { Skeleton } from "./Skeleton";

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  variant?: "spinner" | "skeleton";
}

export function LoadingState({
  title = "Loading…",
  description,
  className = "",
  variant = "spinner",
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div
        className={`surface-card space-y-4 px-6 py-8 ${className}`}
        role="status"
        aria-live="polite"
        aria-label={title}
      >
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="mt-4 h-10 w-32" />
      </div>
    );
  }

  return (
    <div
      className={`surface-card flex flex-col items-center justify-center px-6 py-14 text-center sm:py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-scanonix-orange"
        aria-hidden="true"
      />
      <h3 className="text-section-title mt-5">{title}</h3>
      {description ? <p className="text-body mt-2 max-w-md">{description}</p> : null}
    </div>
  );
}
