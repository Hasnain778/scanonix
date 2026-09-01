"use client";

import type { ReactNode } from "react";
import type { ScanReportFileIntelligence } from "@/lib/scan-report/types";

interface ScanReportFileIntelligencePanelProps {
  intelligence: ScanReportFileIntelligence;
}

const RISK_STYLES: Record<ScanReportFileIntelligence["riskLevel"], string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ScanReportFileIntelligencePanel({
  intelligence,
}: ScanReportFileIntelligencePanelProps) {
  const metaEntries = Object.entries(intelligence.extractedMetadata).slice(0, 8);

  return (
    <section aria-labelledby="file-intelligence-heading" className="glass-card rounded-2xl p-6 shadow-premium">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="file-intelligence-heading" className="text-lg font-semibold text-foreground">
            File Intelligence
          </h2>
          <p className="mt-1 text-sm text-scanonix-muted">
            Metadata and static analysis for {intelligence.fileName}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${RISK_STYLES[intelligence.riskLevel]}`}
        >
          {intelligence.riskLevel} risk
        </span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Risk score" value={`${intelligence.riskScore}/100`} />
        <Metric label="Size" value={formatBytes(intelligence.sizeBytes)} />
        <Metric label="Format" value={intelligence.extension || "unknown"} />
        <Metric label="Confidence" value={`${intelligence.confidence}%`} />
      </div>

      <p className="mb-6 text-sm leading-relaxed text-foreground-secondary">{intelligence.summary}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoBlock title="File metadata">
          <Row label="Filename" value={intelligence.fileName} />
          <Row label="Extension" value={intelligence.extension || "none"} />
          <Row label="Reported MIME" value={intelligence.mimeType} />
          <Row label="Detected MIME" value={intelligence.detectedMimeType} />
          <Row label="Format family" value={intelligence.formatFamily} />
          <Row label="SHA256" value={intelligence.sha256} mono />
          <Row label="MD5" value={intelligence.md5} mono />
          <Row label="Uploaded" value={new Date(intelligence.uploadedAt).toLocaleString("en-GB")} />
          <Row
            label="Last modified"
            value={
              intelligence.lastModified
                ? new Date(intelligence.lastModified).toLocaleString("en-GB")
                : "Not available"
            }
          />
        </InfoBlock>

        {metaEntries.length > 0 ? (
          <InfoBlock title="Extracted metadata">
            {metaEntries.map(([key, value]) => (
              <Row
                key={key}
                label={key}
                value={Array.isArray(value) ? value.join(", ") : String(value)}
              />
            ))}
          </InfoBlock>
        ) : (
          <InfoBlock title="Analysis coverage">
            <Row
              label="Supported format"
              value={intelligence.formatSupported ? "Yes" : "Limited"}
            />
            <Row label="Analyzer" value="Static file intelligence engine" />
          </InfoBlock>
        )}
      </div>

      {intelligence.recommendations.length > 0 ? (
        <div className="mt-6 rounded-xl border border-scanonix-orange/25 bg-scanonix-orange/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-orange">
            Recommendations
          </p>
          <ul className="mt-2 space-y-1.5">
            {intelligence.recommendations.map((item) => (
              <li key={item} className="text-sm text-foreground-secondary">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-scanonix-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-scanonix-muted">{label}</dt>
      <dd className={`text-sm text-foreground-secondary sm:text-right break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
