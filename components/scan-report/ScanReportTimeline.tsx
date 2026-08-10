"use client";

import { motion } from "framer-motion";
import type { ScanReportTimelineStage } from "@/lib/scan-report/types";

interface ScanReportTimelineProps {
  stages: ScanReportTimelineStage[];
}

export function ScanReportTimeline({ stages }: ScanReportTimelineProps) {
  return (
    <section aria-labelledby="timeline-heading">
      <h3 id="timeline-heading" className="mb-5 text-lg font-semibold text-white">
        Scan timeline
      </h3>

      <ol className="space-y-0">
        {stages.map((stage, index) => (
          <li key={stage.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < stages.length - 1 ? (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-white/10"
                aria-hidden="true"
              />
            ) : null}

            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
                stage.completed
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-white/15 bg-black/30 text-scanonix-muted"
              }`}
              aria-hidden="true"
            >
              {stage.completed ? "✓" : "·"}
            </motion.span>

            <div className="min-w-0 flex-1 rounded-xl border border-white/6 bg-black/20 px-4 py-3">
              <p className="font-medium text-white">{stage.label}</p>
              <p className="text-sm text-scanonix-muted">
                {stage.completed ? "Completed" : "Pending"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
