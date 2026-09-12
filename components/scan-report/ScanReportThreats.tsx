"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getDifficultyLabel,
  getSeverityAccent,
  getSeverityStyles,
  severityRank,
} from "@/lib/scan-report/utils";
import type { ScanReportFinding } from "@/lib/scan-report/types";
import { ScanReportEmptySuccess } from "@/components/scan-report/ScanReportEmptySuccess";

interface ScanReportThreatsProps {
  findings: ScanReportFinding[];
}

export function ScanReportThreats({ findings }: ScanReportThreatsProps) {
  const ordered = useMemo(
    () =>
      findings
        .slice()
        .sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    [findings],
  );

  if (ordered.length === 0) {
    return (
      <section aria-labelledby="threat-summary-heading">
        <h2
          id="threat-summary-heading"
          className="mb-3 text-lg font-semibold text-foreground"
        >
          Threat summary
        </h2>
        <ScanReportEmptySuccess />
      </section>
    );
  }

  return (
    <section aria-labelledby="threat-summary-heading">
      <h2
        id="threat-summary-heading"
        className="text-lg font-semibold text-foreground"
      >
        Threat summary
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-foreground/70">
        {ordered.length} finding{ordered.length === 1 ? "" : "s"} detected during
        this scan.
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        <ul className="divide-y divide-border">
          {ordered.map((finding, index) => (
            <ThreatRow key={finding.id} finding={finding} index={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ThreatRow({
  finding,
  index,
}: {
  finding: ScanReportFinding;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const panelId = `finding-panel-${finding.id}`;

  return (
    <li className="relative">
      <div
        className={`absolute inset-y-0 left-0 w-1 ${getSeverityAccent(finding.severity)}`}
        aria-hidden="true"
      />

      <button
        type="button"
        className="flex w-full items-start gap-3 py-2.5 pl-3.5 pr-3 text-left transition-colors hover:bg-surface-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-scanonix-orange/50 sm:pl-4"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getSeverityStyles(finding.severity)}`}
            >
              {finding.severity}
            </span>
            <span className="text-sm font-semibold leading-snug text-foreground">
              {finding.title}
            </span>
          </span>
          <span className="mt-1 block text-sm leading-snug text-foreground/75 line-clamp-2">
            {finding.description}
          </span>
          {!expanded && finding.recommendation ? (
            <span className="mt-1.5 block text-xs leading-snug text-foreground/65">
              <span className="font-semibold text-foreground">Action: </span>
              {finding.recommendation}
            </span>
          ) : null}
        </span>
        <svg
          className={`mt-1 h-4 w-4 shrink-0 text-foreground/55 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.25}
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
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border bg-surface-muted/40"
          >
            <div className="space-y-3 px-3.5 py-3 sm:px-4">
              <DetailBlock label="Why it matters" value={finding.whyItMatters} />
              <DetailBlock
                label="Suggested action"
                value={finding.recommendation}
                emphasize
              />
              {finding.affectedFile ? (
                <DetailBlock
                  label="Affected file"
                  value={finding.affectedFile}
                  mono
                />
              ) : null}
              {finding.evidence ? (
                <DetailBlock label="Evidence" value={finding.evidence} mono />
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/65">
                <span>
                  Difficulty:{" "}
                  <span className="font-semibold text-foreground">
                    {getDifficultyLabel(finding.fixDifficulty)}
                  </span>
                </span>
                {typeof finding.confidence === "number" ? (
                  <span>
                    Confidence:{" "}
                    <span className="font-semibold text-foreground">
                      {finding.confidence}%
                    </span>
                  </span>
                ) : null}
              </div>

              {finding.references && finding.references.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/55">
                    References
                  </p>
                  <ul className="space-y-1">
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
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function DetailBlock({
  label,
  value,
  emphasize = false,
  mono = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/55">
        {label}
      </p>
      <p
        className={`mt-1 text-sm leading-relaxed text-foreground ${
          emphasize ? "border-l-2 border-scanonix-orange/20 pl-2.5" : ""
        } ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
