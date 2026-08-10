"use client";

import { motion } from "framer-motion";
import { SecurityScoreRing } from "@/components/scan-report/SecurityScoreRing";
import type { ScanReport } from "@/lib/scan-report/types";

type Verdict = "safe" | "warning" | "dangerous";

function getVerdict(report: ScanReport): Verdict {
  if (report.riskScore <= 25) return "safe";
  if (report.riskScore <= 60) return "warning";
  return "dangerous";
}

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; emoji: string; description: string; accent: string; badge: string }
> = {
  safe: {
    label: "Safe",
    emoji: "🛡",
    description: "No serious threats were found. Your target passed the main security checks.",
    accent: "border-emerald-500/20 bg-emerald-500/5",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  warning: {
    label: "Warning",
    emoji: "🛡",
    description: "Some issues need attention. Review the recommendations below.",
    accent: "border-amber-500/20 bg-amber-500/5",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  },
  dangerous: {
    label: "Dangerous",
    emoji: "🛡",
    description: "Serious threats were detected. Address the findings as soon as possible.",
    accent: "border-red-500/25 bg-red-500/5",
    badge: "border-red-500/30 bg-red-500/10 text-red-200",
  },
};

interface ScanReportStatusHeroProps {
  report: ScanReport;
}

export function ScanReportStatusHero({ report }: ScanReportStatusHeroProps) {
  const verdict = getVerdict(report);
  const config = VERDICT_CONFIG[verdict];
  const securityScore = 100 - report.riskScore;
  const targetLabel = report.targetType === "website" ? "Website" : "File";

  return (
    <section
      className={`report-hero overflow-hidden rounded-3xl border bg-[#0c0c0c]/70 backdrop-blur-sm ${config.accent}`}
    >
      <div className="p-8 sm:p-10 lg:p-12">
        <p className="text-sm text-scanonix-muted">
          {targetLabel} scan · <span className="text-white">{report.target}</span>
        </p>

        <div className="mt-10 flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center lg:text-left"
          >
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide ${config.badge}`}
            >
              <span aria-hidden="true">{config.emoji}</span>
              {config.label}
            </span>
            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-scanonix-muted lg:mx-0 sm:text-lg">
              {config.description}
            </p>

            {report.summary ? (
              <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
                <SummaryPill label="Critical" value={report.summary.criticalIssues} tone="text-red-300" />
                <SummaryPill label="Warnings" value={report.summary.warnings} tone="text-amber-200" />
                <SummaryPill label="Passed" value={report.summary.passedChecks} tone="text-emerald-300" />
              </div>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="shrink-0"
          >
            <SecurityScoreRing score={securityScore} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function getReportVerdictLabel(report: ScanReport): string {
  return VERDICT_CONFIG[getVerdict(report)].label;
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-3 text-center sm:px-4">
      <p className={`text-xl font-semibold sm:text-2xl ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-scanonix-muted">{label}</p>
    </div>
  );
}
