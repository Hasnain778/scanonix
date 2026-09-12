"use client";

import { motion } from "framer-motion";
import {
  getDifficultyLabel,
  getSeverityAccent,
  getSeverityStyles,
  severityRank,
} from "@/lib/scan-report/utils";
import type { ScanReportFinding } from "@/lib/scan-report/types";
import { ScanReportEmptySuccess } from "@/components/scan-report/ScanReportEmptySuccess";

interface ScanReportAiRecommendationsProps {
  findings: ScanReportFinding[];
}

export function ScanReportAiRecommendations({
  findings,
}: ScanReportAiRecommendationsProps) {
  const recommendations = findings
    .filter((finding) => finding.ai || finding.recommendation)
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 4);

  if (recommendations.length === 0) {
    return (
      <section aria-labelledby="recommendations-heading">
        <h2
          id="recommendations-heading"
          className="mb-3 text-lg font-semibold text-foreground"
        >
          Recommendations
        </h2>
        <ScanReportEmptySuccess />
      </section>
    );
  }

  return (
    <section aria-labelledby="recommendations-heading">
      <h2
        id="recommendations-heading"
        className="text-lg font-semibold text-foreground"
      >
        Recommendations
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-foreground/70">
        Priority actions to reduce risk, ordered by severity.
      </p>

      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        {recommendations.map((finding, index) => {
          const action =
            finding.ai?.remediationSteps?.[0] ?? finding.recommendation;
          const explanation =
            finding.ai?.plainEnglishExplanation ?? finding.description;
          const difficulty =
            finding.ai?.estimatedDifficulty ?? finding.fixDifficulty;

          return (
            <motion.li
              key={finding.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25 }}
              className="relative flex gap-0"
            >
              <div
                className={`w-1 shrink-0 self-stretch ${getSeverityAccent(finding.severity)}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-foreground/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getSeverityStyles(finding.severity)}`}
                  >
                    {finding.severity}
                  </span>
                  {difficulty ? (
                    <span className="text-[11px] font-medium text-foreground/60">
                      {getDifficultyLabel(difficulty)}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-1.5 text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                  {finding.title}
                </h3>

                <p className="mt-1 text-sm leading-snug text-foreground/75">
                  {explanation}
                </p>

                <p className="mt-2 text-sm leading-snug">
                  <span className="font-semibold text-foreground">Action: </span>
                  <span className="text-foreground/85">{action}</span>
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
