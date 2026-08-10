"use client";

import { motion } from "framer-motion";
import { getDifficultyLabel, getSeverityStyles } from "@/lib/scan-report/utils";
import type { ScanReportFinding } from "@/lib/scan-report/types";
import { ScanReportEmptySuccess } from "@/components/scan-report/ScanReportEmptySuccess";

interface ScanReportAiRecommendationsProps {
  findings: ScanReportFinding[];
}

export function ScanReportAiRecommendations({ findings }: ScanReportAiRecommendationsProps) {
  const recommendations = findings.filter(
    (finding) => finding.ai || finding.recommendation,
  );

  if (recommendations.length === 0) {
    return (
      <section aria-labelledby="recommendations-heading">
        <h2 id="recommendations-heading" className="mb-6 text-xl font-semibold text-white">
          Recommendations
        </h2>
        <ScanReportEmptySuccess />
      </section>
    );
  }

  const topItems = recommendations.slice(0, 4);

  return (
    <section aria-labelledby="recommendations-heading">
      <h2 id="recommendations-heading" className="mb-2 text-xl font-semibold text-white">
        Recommendations
      </h2>
      <p className="mb-6 text-base text-scanonix-muted">
        What to do next, in plain language.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {topItems.map((finding, index) => (
          <motion.article
            key={finding.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35 }}
            className="report-card rounded-2xl border border-white/8 bg-[#0c0c0c]/50 p-5 sm:p-6"
          >
            <div className="mb-3 flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-scanonix-orange/12 text-lg"
                aria-hidden="true"
              >
                💡
              </span>
              <div className="min-w-0">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getSeverityStyles(finding.severity)}`}
                >
                  {finding.severity}
                </span>
                <h3 className="mt-2 text-base font-semibold text-white">{finding.title}</h3>
              </div>
            </div>

            <p className="text-base leading-relaxed text-scanonix-muted">
              {finding.ai?.plainEnglishExplanation ?? finding.description}
            </p>

            <div className="mt-4 rounded-xl border border-scanonix-orange/20 bg-scanonix-orange/5 px-4 py-3">
              <p className="text-sm font-medium text-scanonix-orange">Suggested action</p>
              <p className="mt-1 text-sm leading-relaxed text-white">
                {finding.ai?.remediationSteps?.[0] ?? finding.recommendation}
              </p>
            </div>

            {finding.ai?.estimatedDifficulty ? (
              <p className="mt-3 text-sm text-scanonix-muted">
                Difficulty: {getDifficultyLabel(finding.ai.estimatedDifficulty)}
              </p>
            ) : null}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
