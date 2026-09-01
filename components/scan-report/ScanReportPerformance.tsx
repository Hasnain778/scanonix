"use client";

import type { ScanReportPerformance } from "@/lib/scan-report/types";
import { formatDuration } from "@/lib/scan-report/utils";

interface ScanReportPerformanceProps {
  performance: ScanReportPerformance;
}

const METRICS = (performance: ScanReportPerformance) => [
  { icon: "⏱", label: "Scan duration", value: formatDuration(performance.durationMs) },
  { icon: "📂", label: "Files processed", value: String(performance.filesProcessed) },
  {
    icon: "⚡",
    label: "Average speed",
    value: `${performance.averageSpeedPerSecond.toFixed(1)} files/s`,
  },
  {
    icon: "🤖",
    label: "AI tokens",
    value:
      performance.aiTokensUsed != null
        ? performance.aiTokensUsed.toLocaleString()
        : "Not available",
  },
];

export function ScanReportPerformancePanel({
  performance,
}: ScanReportPerformanceProps) {
  const metrics = METRICS(performance);

  return (
    <section aria-labelledby="performance-heading">
      <h3 id="performance-heading" className="mb-5 text-lg font-semibold text-foreground">
        Performance
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface-muted px-4 py-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-scanonix-orange/10 text-lg" aria-hidden="true">
              {metric.icon}
            </span>
            <div>
              <p className="text-sm text-scanonix-muted">{metric.label}</p>
              <p className="text-base font-semibold text-foreground">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
