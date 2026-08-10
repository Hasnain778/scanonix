"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ActionButton } from "@/components/ui/ActionButton";
import { RecentScansSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { buttonTap } from "@/components/dashboard/dashboard-motion";
import {
  formatRelativeDate,
  getFriendlyRiskLabel,
} from "@/components/dashboard/dashboard-utils";
import type { DashboardScan, ScanRisk } from "@/components/dashboard/dashboard-types";

const RISK_STYLES: Record<ScanRisk, string> = {
  low: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  high: "border-red-500/30 bg-red-500/10 text-red-300",
  critical: "border-red-900/50 bg-red-950/40 text-red-200",
};

const TIMELINE_DOT: Record<ScanRisk, string> = {
  low: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]",
  medium: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
  high: "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.45)]",
  critical: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]",
};

interface DashboardRecentScansProps {
  scans: DashboardScan[];
  loading?: boolean;
}

export function DashboardRecentScans({ scans, loading = false }: DashboardRecentScansProps) {
  if (loading) {
    return <RecentScansSkeleton />;
  }

  return (
    <section aria-labelledby="recent-scans-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="recent-scans-heading" className="text-xl font-semibold text-white">
            Recent scans
          </h2>
          <p className="mt-1 text-base text-scanonix-muted">
            Your latest security check results
          </p>
        </div>
        {scans.length > 0 ? (
          <Link
            href="/scan-history"
            className="rounded-lg px-2 py-1 text-sm font-medium text-scanonix-orange transition-colors hover:text-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
          >
            View all
          </Link>
        ) : null}
      </div>

      {scans.length === 0 ? (
        <RecentScansEmptyState />
      ) : (
        <ol className="dashboard-timeline relative space-y-4">
          {scans.map((scan, index) => (
            <motion.li
              key={scan.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              className="dashboard-timeline-item relative pl-8"
            >
              <span
                className={`dashboard-timeline-dot absolute left-0 top-6 h-3 w-3 rounded-full ${TIMELINE_DOT[scan.risk]}`}
                aria-hidden="true"
              />

              <article className="dashboard-scan-card rounded-2xl border border-white/10 bg-[#0c0c0c]/50 p-5 backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-white">{scan.target}</p>
                    <time
                      dateTime={scan.date}
                      className="mt-2 block text-sm text-scanonix-muted"
                    >
                      {formatRelativeDate(scan.date)}
                    </time>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                    <RiskBadge risk={scan.risk} />
                    <Link
                      href={`/scan-results/${scan.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/12 px-4 text-sm font-semibold text-scanonix-orange transition-colors hover:border-scanonix-orange/40 hover:bg-scanonix-orange/5 hover:text-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
                    >
                      View Report
                    </Link>
                  </div>
                </div>
              </article>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RiskBadge({ risk }: { risk: ScanRisk }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${RISK_STYLES[risk]}`}
    >
      {getFriendlyRiskLabel(risk)}
    </span>
  );
}

function RecentScansEmptyState() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0c0c0c]/40 px-6 py-14 text-center backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="dashboard-empty-icon mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-linear-to-br from-scanonix-orange/15 to-transparent"
        aria-hidden="true"
      >
        <svg
          className="h-12 w-12 text-scanonix-orange"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016m-7.036 1.036a3 3 0 113 3 3 3 0 01-3-3z"
          />
        </svg>
      </motion.div>

      <h3 className="text-xl font-semibold text-white">No scans yet</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-scanonix-muted">
        Run your first security scan to see results here.
      </p>

      <motion.div {...buttonTap} className="mt-8 inline-block">
        <ActionButton href="/tools/security-scan" size="lg">
          Start first scan
        </ActionButton>
      </motion.div>
    </div>
  );
}
