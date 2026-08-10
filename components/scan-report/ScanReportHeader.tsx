"use client";

import { motion } from "framer-motion";
import { MonitorButton } from "@/components/monitors/MonitorButton";
import { RiskScoreRing } from "@/components/scan-report/RiskScoreRing";
import { formatDuration, formatReportDate, getRiskScoreColor } from "@/lib/scan-report/utils";
import type { ScanReport } from "@/lib/scan-report/types";

interface ScanReportHeaderProps {
  report: ScanReport;
  isDemo?: boolean;
}

export function ScanReportHeader({ report, isDemo = false }: ScanReportHeaderProps) {
  const risk = getRiskScoreColor(report.riskScore);
  const targetLabel = report.targetType === "website" ? "Website scanned" : "File scanned";

  return (
    <section
      className={`glass-card overflow-hidden rounded-3xl bg-linear-to-br ${risk.bg} to-transparent p-6 shadow-premium-lg sm:p-8`}
    >
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-scanonix-muted">
            Security scan report
          </p>
          <h1 className="mt-3 break-all text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {report.target}
          </h1>
          <p className="mt-2 text-sm text-scanonix-muted">{targetLabel}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric label="Completed" value={formatReportDate(report.completedAt)} />
            <Metric label="Duration" value={formatDuration(report.durationMs)} />
            <Metric label="Assessment" value={risk.label} valueClass={risk.text} />
          </dl>

          {report.targetType === "website" ? (
            <div className="mt-5 print:hidden">
              <MonitorButton targetUrl={report.target} isDemo={isDemo} />
            </div>
          ) : null}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="justify-self-center lg:justify-self-end"
        >
          <RiskScoreRing score={report.riskScore} />
        </motion.div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-muted">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-semibold sm:text-base ${valueClass}`}>{value}</dd>
    </div>
  );
}
