"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getDifficultyLabel, getSeverityStyles } from "@/lib/scan-report/utils";
import type { ScanReportFinding } from "@/lib/scan-report/types";
import { ScanReportEmptySuccess } from "@/components/scan-report/ScanReportEmptySuccess";

const SEVERITY_ICON: Record<string, string> = {
  critical: "🔴",
  high: "🔴",
  medium: "🟡",
  low: "🟢",
  info: "🔵",
};

interface ScanReportThreatsProps {
  findings: ScanReportFinding[];
}

export function ScanReportThreats({ findings }: ScanReportThreatsProps) {
  if (findings.length === 0) {
    return (
      <section aria-labelledby="threat-summary-heading">
        <h2 id="threat-summary-heading" className="mb-6 text-xl font-semibold text-white">
          Threat summary
        </h2>
        <ScanReportEmptySuccess />
      </section>
    );
  }

  return (
    <section aria-labelledby="threat-summary-heading">
      <h2 id="threat-summary-heading" className="mb-2 text-xl font-semibold text-white">
        Threat summary
      </h2>
      <p className="mb-6 text-base text-scanonix-muted">
        {findings.length} finding{findings.length === 1 ? "" : "s"} detected during this scan.
      </p>

      <div className="space-y-4">
        {findings.map((finding, index) => (
          <ThreatCard key={finding.id} finding={finding} index={index} />
        ))}
      </div>
    </section>
  );
}

function ThreatCard({
  finding,
  index,
}: {
  finding: ScanReportFinding;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const panelId = `finding-panel-${finding.id}`;
  const icon = SEVERITY_ICON[finding.severity] ?? "⚠️";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="report-card overflow-hidden rounded-2xl border border-white/8 bg-[#0c0c0c]/50"
    >
      <button
        type="button"
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-white/[0.02] sm:p-6"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">{finding.title}</span>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getSeverityStyles(finding.severity)}`}
            >
              {finding.severity}
            </span>
          </span>
          <span className="mt-2 block text-base leading-relaxed text-scanonix-muted line-clamp-2">
            {finding.description}
          </span>
        </span>
        <svg
          className={`mt-1 h-5 w-5 shrink-0 text-scanonix-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/6"
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <DetailCard label="Why it matters" value={finding.whyItMatters} />
              <DetailCard label="Recommendation" value={finding.recommendation} highlight />
              {finding.affectedFile ? (
                <DetailCard label="Affected file" value={finding.affectedFile} mono />
              ) : null}
              {finding.evidence ? (
                <DetailCard label="Evidence" value={finding.evidence} mono />
              ) : null}
              <DetailCard
                label="Fix difficulty"
                value={getDifficultyLabel(finding.fixDifficulty)}
              />
              {typeof finding.confidence === "number" ? (
                <DetailCard label="Confidence" value={`${finding.confidence}%`} />
              ) : null}
            </div>

            {finding.references && finding.references.length > 0 ? (
              <div className="border-t border-white/6 px-5 py-4 sm:px-6">
                <p className="mb-2 text-sm font-medium text-scanonix-muted">References</p>
                <ul className="space-y-2">
                  {finding.references.map((reference) => (
                    <li key={reference.url}>
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-scanonix-orange hover:underline"
                      >
                        {reference.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

function DetailCard({
  label,
  value,
  highlight = false,
  mono = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-scanonix-orange/20 bg-scanonix-orange/5"
          : "border-white/6 bg-black/20"
      }`}
    >
      <p className="text-sm font-medium text-scanonix-muted">{label}</p>
      <p className={`mt-2 text-sm leading-relaxed text-white ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </p>
    </div>
  );
}
