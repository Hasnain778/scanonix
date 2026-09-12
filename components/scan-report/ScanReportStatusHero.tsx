"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
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
  {
    label: string;
    description: string;
    accent: string;
    badge: string;
    bar: string;
    Icon: typeof ShieldCheck;
  }
> = {
  safe: {
    label: "Safe",
    description: "No serious threats were found. Your target passed the main security checks.",
    accent: "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5",
    badge:
      "border-emerald-700 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
    bar: "bg-emerald-600 dark:bg-emerald-500",
    Icon: ShieldCheck,
  },
  warning: {
    label: "Warning",
    description: "Some issues need attention. Review the recommendations below.",
    accent: "border-amber-500/20 bg-amber-50 dark:bg-amber-500/5",
    badge:
      "border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100",
    bar: "bg-amber-600 dark:bg-amber-500",
    Icon: AlertTriangle,
  },
  dangerous: {
    label: "Dangerous",
    description: "Serious threats were detected. Address the findings as soon as possible.",
    accent: "border-red-500/25 bg-red-50 dark:bg-red-500/5",
    /* Colors via .report-verdict-badge--dangerous (data-theme), not Tailwind dark: */
    badge: "report-verdict-badge--dangerous rounded-md",
    bar: "bg-red-600",
    Icon: ShieldAlert,
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
  const Icon = config.Icon;

  return (
    <section
      className={`report-hero relative overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-[var(--shadow-soft)] ${config.accent}`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-2 ${config.bar}`}
        aria-hidden="true"
      />

      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-xs font-medium text-foreground/70 sm:text-sm">
              {targetLabel} scan ·{" "}
              <span className="font-semibold text-foreground">{report.target}</span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${config.badge}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.5} />
                {config.label}
              </span>
              <span className="text-xs font-medium text-foreground/75 sm:text-sm">
                Security score {securityScore}/100
              </span>
            </div>

            <p className="mt-2.5 max-w-xl text-sm leading-snug text-foreground/80">
              {config.description}
            </p>

            {report.summary ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-2.5">
                <SummaryPill
                  label="Critical"
                  value={report.summary.criticalIssues}
                  tone="text-red-700 dark:text-red-300"
                  edge="border-red-600/50 dark:border-red-500/40"
                />
                <SummaryPill
                  label="Warnings"
                  value={report.summary.warnings}
                  tone="text-amber-800 dark:text-amber-200"
                  edge="border-amber-600/50 dark:border-amber-500/40"
                />
                <SummaryPill
                  label="Passed"
                  value={report.summary.passedChecks}
                  tone="text-emerald-800 dark:text-emerald-300"
                  edge="border-emerald-600/50 dark:border-emerald-500/40"
                />
              </div>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mx-auto shrink-0 lg:mx-0"
          >
            <SecurityScoreRing score={securityScore} size={136} />
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
  edge,
}: {
  label: string;
  value: number;
  tone: string;
  edge: string;
}) {
  return (
    <div
      className={`rounded-lg border-2 bg-surface px-2.5 py-2 text-center sm:px-3 ${edge}`}
    >
      <p className={`text-lg font-bold tabular-nums sm:text-xl ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/65 sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}
