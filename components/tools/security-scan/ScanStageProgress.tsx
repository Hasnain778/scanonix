"use client";

import { motion, useReducedMotion } from "framer-motion";

export const SCAN_STAGES = [
  "Initializing",
  "Checking SSL",
  "Malware Detection",
  "Phishing Detection",
  "AI Analysis",
  "Generating Report",
] as const;

interface ScanStageProgressProps {
  progress: number;
  activeStageIndex: number;
  complete?: boolean;
}

export function ScanStageProgress({
  progress,
  activeStageIndex,
  complete = false,
}: ScanStageProgressProps) {
  const reduceMotion = useReducedMotion();
  const percent = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="scan-progress-panel space-y-8">
      <div className="text-center">
        <p className="text-sm text-scanonix-muted">
          {complete ? "Scan complete" : "Scanning in progress"}
        </p>
        <p className="scan-progress-percent mt-2 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          {percent}%
        </p>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="scan-progress-bar absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-scanonix-orange to-scanonix-orange-light"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
          }
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Scan progress"
        />
      </div>

      <ul className="space-y-3" aria-label="Scan stages">
        {SCAN_STAGES.map((stage, index) => {
          const isDone = complete || index < activeStageIndex;
          const isActive = !complete && index === activeStageIndex;

          return (
            <motion.li
              key={stage}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={`scan-stage-row flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
                isActive
                  ? "border-scanonix-orange/30 bg-scanonix-orange/8 scan-stage-active"
                  : isDone
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-white/6 bg-white/[0.02]"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  isDone
                    ? "bg-emerald-500/20 text-emerald-300"
                    : isActive
                      ? "bg-scanonix-orange/20 text-scanonix-orange"
                      : "bg-white/6 text-scanonix-muted"
                }`}
                aria-hidden="true"
              >
                {isDone ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive ? (
                  <span className="scan-stage-dot h-2 w-2 rounded-full bg-scanonix-orange" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                )}
              </span>
              <span
                className={`text-base ${
                  isDone
                    ? "text-emerald-100"
                    : isActive
                      ? "font-medium text-white"
                      : "text-scanonix-muted"
                }`}
              >
                {stage}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
