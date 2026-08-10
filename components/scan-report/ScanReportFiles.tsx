"use client";

import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import type { ScanReportFilesSummary } from "@/lib/scan-report/types";

interface ScanReportFilesProps {
  files: ScanReportFilesSummary;
}

const FILE_ROWS = [
  { key: "scanned" as const, label: "Files scanned", icon: "📁", tone: "text-white" },
  { key: "suspicious" as const, label: "Suspicious", icon: "⚠️", tone: "text-amber-200" },
  { key: "safe" as const, label: "Safe", icon: "✓", tone: "text-emerald-300" },
  { key: "ignored" as const, label: "Ignored", icon: "—", tone: "text-scanonix-muted" },
];

export function ScanReportFiles({ files }: ScanReportFilesProps) {
  return (
    <section aria-labelledby="files-heading">
      <h3 id="files-heading" className="mb-5 text-lg font-semibold text-white">
        Files analysed
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {FILE_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-4 rounded-xl border border-white/8 bg-black/20 px-4 py-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-lg" aria-hidden="true">
              {row.icon}
            </span>
            <div>
              <p className="text-sm text-scanonix-muted">{row.label}</p>
              <p className={`text-2xl font-semibold ${row.tone}`}>
                <AnimatedNumber value={files[row.key]} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
