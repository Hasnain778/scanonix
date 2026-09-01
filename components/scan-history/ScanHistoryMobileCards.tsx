"use client";

import { motion } from "framer-motion";
import {
  formatScanDate,
  formatScanDuration,
  getRiskLevelBadgeClass,
  getRiskLevelLabel,
  getStatusBadgeClass,
} from "@/lib/scan-history/utils";
import type { ScanHistoryRecord } from "@/lib/scan-history/types";
import { ScanHistoryActionsMenu } from "@/components/scan-history/ScanHistoryActionsMenu";

interface ScanHistoryMobileCardsProps {
  items: ScanHistoryRecord[];
  premiumUnlocked: boolean;
  actionBusy: boolean;
  onDownloadJson: (scan: ScanHistoryRecord) => void;
  onDownloadPdf: (scan: ScanHistoryRecord) => void;
  onDelete: (scan: ScanHistoryRecord) => void;
}

export function ScanHistoryMobileCards({
  items,
  premiumUnlocked,
  actionBusy,
  onDownloadJson,
  onDownloadPdf,
  onDelete,
}: ScanHistoryMobileCardsProps) {
  return (
    <div className="space-y-3 lg:hidden">
      {items.map((scan, index) => (
        <motion.article
          key={scan.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04, duration: 0.3 }}
          className="rounded-2xl border border-border bg-surface-muted p-4 shadow-premium"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-foreground">{scan.target}</h3>
              <p className="mt-1 text-xs capitalize text-scanonix-muted">{scan.targetType} scan</p>
            </div>
            <ScanHistoryActionsMenu
              scan={scan}
              premiumUnlocked={premiumUnlocked}
              busy={actionBusy}
              onDownloadJson={onDownloadJson}
              onDownloadPdf={onDownloadPdf}
              onDelete={onDelete}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-scanonix-muted">Risk score</dt>
              <dd className="font-semibold text-foreground">{scan.riskScore}</dd>
            </div>
            <div>
              <dt className="text-xs text-scanonix-muted">Duration</dt>
              <dd className="text-foreground">{formatScanDuration(scan.durationMs)}</dd>
            </div>
            <div>
              <dt className="text-xs text-scanonix-muted">Risk level</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskLevelBadgeClass(scan.riskLevel)}`}
                >
                  {getRiskLevelLabel(scan.riskLevel)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-scanonix-muted">Status</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${getStatusBadgeClass(scan.status)}`}
                >
                  {scan.status}
                </span>
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-scanonix-muted">{formatScanDate(scan.createdAt)}</p>
        </motion.article>
      ))}
    </div>
  );
}
