interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({
  label = "Loading…",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`surface-card flex items-center justify-center gap-3 px-6 py-12 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-scanonix-orange"
        aria-hidden="true"
      />
      <span className="text-sm text-scanonix-muted">{label}</span>
    </div>
  );
}
