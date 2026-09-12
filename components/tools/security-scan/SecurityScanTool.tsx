"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Shield } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProBadge } from "@/components/ui/ProBadge";
import { ProSecurityGate } from "@/components/tools/security/ProSecurityGate";
import {
  SCAN_STAGES,
  ScanStageProgress,
} from "@/components/tools/security-scan/ScanStageProgress";
import { useProAccess } from "@/hooks/useProAccess";
import { createProcessAttempt, planErrorMessageToCode } from "@/lib/analytics/process-lifecycle";
import { runSecurityScan } from "@/lib/scan-history/client";

type ScanPhase = "idle" | "running" | "complete" | "error" | "transitioning";

const PRIVACY_COPY =
  "Scanonix scans the public website from our servers and saves the report to your history. Local, private, and internal addresses are blocked.";

function createScanId(): string {
  return crypto.randomUUID();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function SecurityScanTool() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const initialTarget = searchParams.get("target") ?? "";

  const [websiteTarget, setWebsiteTarget] = useState(initialTarget);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { loading: proLoading, isAuthenticated, isPro } = useProAccess();

  const showProGate = !proLoading && !isPro;
  const isBusy = phase === "running" || phase === "complete" || phase === "transitioning";

  const canSubmit = useMemo(() => {
    if (isBusy || showProGate) return false;
    return websiteTarget.trim().length > 0;
  }, [isBusy, showProGate, websiteTarget]);

  const navigateToReport = useCallback(
    async (recordId: string) => {
      setPhase("complete");
      setProgress(100);
      setStageIndex(SCAN_STAGES.length - 1);

      const transitionDelay = reduceMotion ? 200 : 900;
      await wait(transitionDelay);

      setPhase("transitioning");
      await wait(reduceMotion ? 100 : 450);

      router.push(`/scan-results/${recordId}`);
    },
    [reduceMotion, router],
  );

  const handleRunScan = useCallback(async () => {
    const attempt = createProcessAttempt("security-scan");
    if (!attempt?.markStarted()) return;

    const scanId = createScanId();
    setPhase("running");
    setProgress(4);
    setStageIndex(0);
    setStatusMessage(null);

    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 3, 94));
    }, 350);

    const stageTimer = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, SCAN_STAGES.length - 2));
    }, 1100);

    try {
      const result = await runSecurityScan({
        scanId,
        targetType: "website",
        target: websiteTarget.trim(),
      });

      window.clearInterval(progressTimer);
      window.clearInterval(stageTimer);

      if ("error" in result && !("record" in result)) {
        attempt.error(planErrorMessageToCode(result.error ?? "unknown"));
        setPhase("error");
        setStatusMessage(result.error);
        setProgress(0);
        return;
      }

      const scanResult = result as Extract<typeof result, { record: unknown }>;
      const failed = scanResult.record.status === "failed" || Boolean(scanResult.error);

      if (failed) {
        attempt.error("unknown");
        setPhase("error");
        setStatusMessage(scanResult.error ?? "Scan failed — saved to history.");
        setProgress(0);
        return;
      }

      attempt.success(1);
      await navigateToReport(scanResult.record.id);
    } catch (error) {
      attempt.error("network");
      window.clearInterval(progressTimer);
      window.clearInterval(stageTimer);
      setPhase("error");
      setProgress(0);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not complete the scan.",
      );
    }
  }, [navigateToReport, websiteTarget]);

  return (
    <motion.div
      layout
      className="mx-auto max-w-3xl space-y-5 overflow-x-hidden pb-4"
      animate={phase === "transitioning" ? { opacity: 0, y: -12 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
          <Shield className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
              Security Scan
            </p>
            <ProBadge />
          </div>
          <p className="text-sm font-medium text-foreground">Website Scanner</p>
        </div>
      </div>

      {statusMessage && phase === "error" ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {statusMessage}
        </motion.div>
      ) : null}

      <section className="scan-tool-card overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-[var(--shadow-soft)] backdrop-blur-sm">
        <AnimatePresence mode="wait">
          {isBusy ? (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="relative p-6 sm:p-8"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.06),transparent_60%)]"
                aria-hidden="true"
              />
              <div className="relative">
                <ScanStageProgress
                  progress={progress}
                  activeStageIndex={stageIndex}
                  complete={phase === "complete" || phase === "transitioning"}
                />
                {phase === "transitioning" ? (
                  <p className="mt-8 text-center text-base text-scanonix-muted">
                    Opening your report…
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="space-y-6 p-6 sm:p-8"
            >
              <div>
                <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
                  Start scan
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-scanonix-muted sm:text-base">
                  Enter a website URL to check for malware, phishing, and security
                  issues.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="website-target"
                  className="text-sm font-medium text-foreground"
                >
                  Website URL
                </label>
                <div className="scan-url-input flex min-h-[3.5rem] items-center gap-3 rounded-xl border border-border bg-surface-muted/40 px-4 transition-all focus-within:border-scanonix-orange/40 focus-within:ring-2 focus-within:ring-scanonix-orange/15 sm:min-h-[3.75rem] sm:px-5">
                  <svg
                    className="h-5 w-5 shrink-0 text-scanonix-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m14.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.064.184-2.083.514-3.037"
                    />
                  </svg>
                  <input
                    id="website-target"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com"
                    value={websiteTarget}
                    onChange={(event) => setWebsiteTarget(event.target.value)}
                    className="w-full bg-transparent text-base text-foreground placeholder:text-scanonix-muted focus:outline-none sm:text-lg"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && canSubmit) {
                        void handleRunScan();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted/40 px-3.5 py-3">
                <p className="text-xs leading-snug text-scanonix-muted">{PRIVACY_COPY}</p>
              </div>

              <div>
                {showProGate ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="focus-ring relative inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/15 px-8 text-base font-semibold text-foreground"
                  >
                    Upgrade to Pro to scan
                  </button>
                ) : (
                  <ActionButton
                    size="lg"
                    className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                    disabled={!canSubmit}
                    onClick={() => void handleRunScan()}
                  >
                    Start Scan
                  </ActionButton>
                )}
              </div>

              {showProGate ? (
                <ProSecurityGate
                  title="Unlock website scanning"
                  description="Enter a URL above, then upgrade to Pro to run website security scans with saved reports."
                  isAuthenticated={isAuthenticated}
                />
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
