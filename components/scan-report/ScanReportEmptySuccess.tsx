"use client";

import { motion } from "framer-motion";
import { ActionButton } from "@/components/ui/ActionButton";

export function ScanReportEmptySuccess() {
  return (
    <section
      className="glass-card rounded-2xl px-6 py-14 text-center shadow-premium sm:py-16"
      aria-labelledby="clean-scan-heading"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-transparent"
      >
        <svg
          className="h-14 w-14 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z"
          />
        </svg>
      </motion.div>

      <h2 id="clean-scan-heading" className="text-2xl font-bold text-foreground">
        No security issues were detected.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-scanonix-muted">
        This target passed all automated checks. Continue monitoring and schedule
        regular scans to maintain a strong security posture.
      </p>

      <div className="mt-8">
        <ActionButton href="/tools/security-scan">Run another scan</ActionButton>
      </div>
    </section>
  );
}
