"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import type { ScanReportSummary } from "@/lib/scan-report/types";

const OVERVIEW_CARDS = [
  {
    key: "criticalIssues" as const,
    label: "Critical Issues",
    description: "Require immediate remediation",
    accent: "from-red-600/25 to-red-600/5 text-red-300",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    key: "warnings" as const,
    label: "Warnings",
    description: "Should be reviewed soon",
    accent: "from-orange-500/25 to-orange-500/5 text-orange-300",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 0v3.75m0-3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "passedChecks" as const,
    label: "Passed Checks",
    description: "Controls validated successfully",
    accent: "from-emerald-500/25 to-emerald-500/5 text-emerald-300",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "aiConfidence" as const,
    label: "AI Confidence",
    description: "Model certainty for findings",
    accent: "from-violet-500/25 to-violet-500/5 text-violet-300",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    suffix: "%",
  },
];

interface ScanReportOverviewProps {
  summary: ScanReportSummary;
}

export function ScanReportOverview({ summary }: ScanReportOverviewProps) {
  return (
    <section aria-labelledby="security-overview-heading">
      <h2 id="security-overview-heading" className="mb-4 text-lg font-semibold text-foreground">
        Security overview
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {OVERVIEW_CARDS.map((card, index) => (
          <motion.article
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="glass-card rounded-2xl p-5 shadow-premium"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-muted">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-bold text-foreground">
                  <AnimatedNumber value={summary[card.key]} />
                  {card.suffix ?? ""}
                </p>
                <p className="mt-2 text-sm text-scanonix-muted">{card.description}</p>
              </div>
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${card.accent}`}
              >
                {card.icon}
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
