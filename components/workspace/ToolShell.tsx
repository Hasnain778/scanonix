import Link from "next/link";
import { type ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";
import { ToolBreadcrumbs } from "@/components/ui/ToolBreadcrumbs";

interface ToolShellProps {
  children: ReactNode;
}

export function ToolShell({ children }: ToolShellProps) {
  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative min-h-screen pt-24 pb-20 sm:pt-28 sm:pb-24">
        {children}
      </main>
      <Footer />
    </>
  );
}

interface ToolPageHeaderProps {
  title: string;
  description: string;
  icon?: ReactNode;
  showBreadcrumbs?: boolean;
  categoryBreadcrumb?: {
    label: string;
    href: string;
  };
}

export function ToolPageHeader({
  title,
  description,
  icon,
  showBreadcrumbs = false,
  categoryBreadcrumb,
}: ToolPageHeaderProps) {
  return (
    <div className="mb-10 sm:mb-12">
      {showBreadcrumbs ? (
        <ToolBreadcrumbs title={title} category={categoryBreadcrumb} />
      ) : (
        <Link
          href="/tools"
          className="home-btn-interactive mb-5 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted transition-all hover:bg-surface-muted hover:text-scanonix-orange"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to all tools
        </Link>
      )}

      <div className="flex items-start gap-5">
        {icon && (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-scanonix-orange shadow-[var(--shadow-soft)] glow-orange-sm">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground-muted sm:text-lg">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ToolLayoutProps {
  children: ReactNode;
  maxWidth?: "5xl" | "6xl" | "7xl";
}

const maxWidthClasses = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export function ToolLayout({
  children,
  maxWidth = "7xl",
}: ToolLayoutProps) {
  return (
    <div className={`mx-auto ${maxWidthClasses[maxWidth]} px-4 sm:px-6 lg:px-8`}>
      {children}
    </div>
  );
}
