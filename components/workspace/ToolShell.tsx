import Link from "next/link";
import { type ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";
import { ToolBreadcrumbs } from "@/components/ui/ToolBreadcrumbs";
import "@/styles/ux-fix02.css";

interface ToolShellProps {
  children: ReactNode;
  /**
   * Static mobile clearance for the fixed Tool Finder launcher.
   * Opt in only on surfaces where the launcher is visible.
   */
  finderClearance?: boolean;
}

export function ToolShell({ children, finderClearance = false }: ToolShellProps) {
  return (
    <>
      <PageBackground />
      <Navbar />
      <main
        className={`tool-shell relative min-h-screen pt-20 pb-16 sm:pt-[5.25rem] sm:pb-20${
          finderClearance ? " tool-finder-page" : ""
        }`}
      >
        {children}
      </main>
      <Footer finderClearance={finderClearance} />
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
  /** Opt-in. Default false keeps the current header spacing and icon size. */
  compact?: boolean;
  /** Opt-in app header. Default keeps the current header, including `compact`. */
  density?: "default" | "app";
}

export function ToolPageHeader({
  title,
  description,
  icon,
  showBreadcrumbs = false,
  categoryBreadcrumb,
  compact = false,
  density = "default",
}: ToolPageHeaderProps) {
  if (density === "app") {
    return (
      <div className="tool-app-header mb-2 sm:mb-4">
        {showBreadcrumbs ? (
          <ToolBreadcrumbs
            title={title}
            category={categoryBreadcrumb}
            size="fine"
          />
        ) : (
          <Link
            href="/tools"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground"
          >
            Back to all tools
          </Link>
        )}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-base leading-snug text-foreground-muted">
            {description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "mb-4" : "mb-6 sm:mb-8"}>
      {showBreadcrumbs ? (
        <ToolBreadcrumbs title={title} category={categoryBreadcrumb} />
      ) : (
        <Link
          href="/tools"
          className="home-btn-interactive mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-foreground-muted transition-all hover:bg-surface-muted hover:text-scanonix-orange"
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
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-soft text-scanonix-orange ${
              compact ? "h-10 w-10" : "h-12 w-12 sm:h-14 sm:w-14"
            }`}
          >
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl sm:leading-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground-muted sm:text-[1.0625rem]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ToolLayoutProps {
  children: ReactNode;
  maxWidth?: "5xl" | "6xl" | "7xl" | "tools";
}

const maxWidthClasses = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  /** SV2-1 tools directory — 90rem / 1440px content width */
  tools: "tools-v2-layout max-w-[90rem]",
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
