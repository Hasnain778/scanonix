import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

export function DashboardQuickActions() {
  return (
    <section aria-labelledby="dashboard-quick-actions-heading" className="surface-card p-5 sm:p-6">
      <h2 id="dashboard-quick-actions-heading" className="text-section-title">
        Quick actions
      </h2>
      <p className="mt-1.5 text-body-bright text-sm">
        Find a tool or jump into the full directory.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          href="/tools"
          className="dashboard-quick-action group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
        >
          <span className="dashboard-quick-action__icon">
            <Search className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-tool-name block text-sm">Find a Tool</span>
            <span className="mt-0.5 block text-xs text-body-bright">Search and filter the workspace</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-scanonix-muted transition-all group-hover:translate-x-0.5 group-hover:text-scanonix-orange-light" aria-hidden="true" />
        </Link>

        <Link
          href="/tools"
          className="dashboard-quick-action group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
        >
          <span className="dashboard-quick-action__icon bg-white/5 text-white">
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-tool-name block text-sm">Browse All Tools</span>
            <span className="mt-0.5 block text-xs text-body-bright">Open the full tools directory</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-scanonix-muted transition-all group-hover:translate-x-0.5 group-hover:text-scanonix-orange-light" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
