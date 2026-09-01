"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ActionButton } from "@/components/ui/ActionButton";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { buttonTap } from "@/components/dashboard/dashboard-motion";
import {
  buildShareUrl,
  serializeReportJson,
} from "@/lib/scan-report/utils";
import { downloadReportPdf } from "@/lib/scan-report/download-pdf";
import type { ScanReport } from "@/lib/scan-report/types";

interface ScanReportDownloadsProps {
  report: ScanReport;
  premiumUnlocked: boolean;
}

export function ScanReportDownloads({
  report,
  premiumUnlocked,
}: ScanReportDownloadsProps) {
  const [loadingFormat, setLoadingFormat] = useState<"pdf" | "json" | "share" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  async function authorizeExport(format: "pdf" | "json"): Promise<boolean> {
    const response = await fetch("/api/reports/authorize-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });

    if (response.status === 403) {
      setError("Upgrade to Pro or Business to unlock premium report exports.");
      return false;
    }

    if (!response.ok) {
      setError("Could not authorize report export.");
      return false;
    }

    return true;
  }

  async function handleJsonDownload() {
    setError(null);
    setShareMessage(null);
    setLoadingFormat("json");

    try {
      const allowed = await authorizeExport("json");
      if (!allowed) return;

      const blob = new Blob([serializeReportJson(report)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `scanonix-report-${report.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingFormat(null);
    }
  }

  async function handlePdfDownload() {
    setError(null);
    setShareMessage(null);
    setLoadingFormat("pdf");

    try {
      const result = await downloadReportPdf(report.id);

      if ("error" in result) {
        setError(
          result.upgrade
            ? "Upgrade to Pro or Business to unlock premium report exports."
            : result.error,
        );
      }
    } finally {
      setLoadingFormat(null);
    }
  }

  async function handleShare() {
    setError(null);
    setShareMessage(null);
    setLoadingFormat("share");

    try {
      const url = buildShareUrl(report.id);
      if (navigator.share) {
        await navigator.share({
          title: `Scanonix report — ${report.target}`,
          text: `Security scan report for ${report.target}`,
          url,
        });
        setShareMessage("Report link shared.");
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Report link copied to clipboard.");
      }
    } catch {
      setError("Could not share this report.");
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <section aria-labelledby="downloads-heading" className="glass-card rounded-2xl p-6 shadow-premium print:hidden">
      <h2 id="downloads-heading" className="mb-2 text-lg font-semibold text-foreground">
        Downloads
      </h2>
      <p className="mb-5 text-sm text-scanonix-muted">
        Export or share this security assessment
      </p>

      {!premiumUnlocked ? (
        <div className="mb-5">
          <UpgradeRequiredNotice feature="PDF and JSON report exports" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <motion.div {...buttonTap}>
          <ActionButton
            loading={loadingFormat === "pdf"}
            disabled={loadingFormat !== null}
            onClick={() => void handlePdfDownload()}
          >
            {loadingFormat === "pdf" ? "Generating PDF…" : "Download PDF"}
          </ActionButton>
        </motion.div>

        <motion.div {...buttonTap}>
          <ActionButton
            variant="outline"
            loading={loadingFormat === "json"}
            disabled={loadingFormat !== null}
            onClick={() => void handleJsonDownload()}
          >
            Download JSON
          </ActionButton>
        </motion.div>

        <motion.div {...buttonTap}>
          <ActionButton
            variant="outline"
            loading={loadingFormat === "share"}
            disabled={loadingFormat !== null}
            onClick={() => void handleShare()}
          >
            Share report
          </ActionButton>
        </motion.div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {shareMessage ? <p className="mt-4 text-sm text-emerald-300">{shareMessage}</p> : null}

      {!premiumUnlocked ? (
        <p className="mt-4 text-sm text-scanonix-muted">
          <Link href="/pricing" className="font-semibold text-scanonix-orange hover:underline">
            Upgrade to unlock premium reports
          </Link>
        </p>
      ) : null}
    </section>
  );
}
