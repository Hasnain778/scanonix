import { type ReactNode } from "react";

interface ResultCardProps {
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ResultCard({
  title,
  children,
  footer,
  className = "",
}: ResultCardProps) {
  return (
    <div
      className={`rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6 ${className}`}
    >
      <h2 className="mb-2 text-lg font-semibold text-white">{title}</h2>
      {children && <div className="text-sm text-scanonix-muted">{children}</div>}
      {footer && <div className="mt-5">{footer}</div>}
    </div>
  );
}
