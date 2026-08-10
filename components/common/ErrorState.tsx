import { ActionButton } from "@/components/ui/ActionButton";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Unable to complete this action",
  message,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`surface-card border-red-500/25 bg-red-500/5 px-6 py-10 text-center ${className}`}
      role="alert"
    >
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400"
        aria-hidden="true"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-section-title">{title}</h3>
      <p className="text-body mx-auto mt-2 max-w-md text-red-200/85">{message}</p>
      {onRetry ? (
        <div className="mt-6">
          <ActionButton variant="outline" onClick={onRetry}>
            {retryLabel}
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
