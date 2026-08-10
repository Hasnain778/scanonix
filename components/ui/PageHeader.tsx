import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`mb-8 sm:mb-10 ${className}`}>
      {eyebrow ? <p className="text-eyebrow mb-3">{eyebrow}</p> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-page-title">{title}</h1>
          {description ? (
            <p className="text-page-description mt-3 max-w-2xl">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
