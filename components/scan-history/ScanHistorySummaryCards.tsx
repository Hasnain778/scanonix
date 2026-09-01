"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import type { ScanHistorySummary } from "@/lib/scan-history/types";

const SUMMARY_CARDS = [
  {
    key: "totalScans" as const,
    label: "Total Scans",
    description: "All recorded scans",
    accent: "from-scanonix-orange/20 to-scanonix-orange/5 text-scanonix-orange",
  },
  {
    key: "highRiskScans" as const,
    label: "High-Risk Scans",
    description: "Risk score 51 or higher",
    accent: "from-red-500/20 to-red-500/5 text-red-300",
  },
  {
    key: "cleanScans" as const,
    label: "Clean Scans",
    description: "Low risk and completed",
    accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
  },
  {
    key: "averageRiskScore" as const,
    label: "Average Risk Score",
    description: "Across completed scans",
    accent: "from-violet-500/20 to-violet-500/5 text-violet-300",
  },
];

export function ScanHistorySummaryCards({ summary }: { summary: ScanHistorySummary }) {
  return (
    <section aria-labelledby="scan-history-summary-heading">
      <h2 id="scan-history-summary-heading" className="sr-only">
        Scan history summary
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((card, index) => (
          <motion.article
            key={card.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
            whileHover={{ y: -3 }}
            className="glass-card rounded-2xl p-5 shadow-premium"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-muted">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-bold text-foreground">
              <AnimatedNumber value={summary[card.key]} />
            </p>
            <p className="mt-2 text-sm text-scanonix-muted">{card.description}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
