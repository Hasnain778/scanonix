import { ActionButton } from "@/components/ui/ActionButton";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`surface-card px-6 py-14 text-center sm:py-16 ${className}`}
      role="status"
    >
      {icon ? (
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-muted text-scanonix-orange"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-section-title text-xl">{title}</h3>
      {description ? (
        <p className="text-body mx-auto mt-3 max-w-md">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <div className="mt-6">
          <ActionButton variant="outline" onClick={onAction}>
            {actionLabel}
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
