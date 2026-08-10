"use client";

import { motion } from "framer-motion";
import type { ScanReportAiAnalysis } from "@/lib/scan-report/types";

interface ScanReportAiSummaryProps {
  analysis: ScanReportAiAnalysis;
}

export function ScanReportAiSummary({ analysis }: ScanReportAiSummaryProps) {
  return (
    <section aria-labelledby="ai-summary-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="ai-summary-heading" className="text-lg font-semibold text-white">
            AI analysis summary
          </h3>
          <p className="mt-1 text-base text-scanonix-muted">
            Executive overview from verified findings
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium text-scanonix-muted">
          {analysis.source === "ai" ? "Cloud AI" : "Deterministic"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title="Executive summary" value={analysis.executiveSummary} />
        <SummaryCard title="Technical summary" value={analysis.technicalSummary} />
        <SummaryCard title="Security posture" value={analysis.overallSecurityPosture} fullWidth />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ListCard title="Top priorities" items={analysis.topPriorities} />
        <ListCard title="Immediate actions" items={analysis.immediateActions} />
        <ListCard title="Long-term recommendations" items={analysis.longTermRecommendations} fullWidth />
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  fullWidth = false,
}: {
  title: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border border-white/6 bg-black/20 p-4 ${fullWidth ? "sm:col-span-2" : ""}`}
    >
      <h4 className="text-sm font-medium text-scanonix-muted">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-white">{value}</p>
    </motion.div>
  );
}

function ListCard({
  title,
  items,
  fullWidth = false,
}: {
  title: string;
  items: string[];
  fullWidth?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border border-white/6 bg-black/20 p-4 ${fullWidth ? "sm:col-span-2" : ""}`}
    >
      <h4 className="text-sm font-medium text-scanonix-muted">{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-white">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-scanonix-orange" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
