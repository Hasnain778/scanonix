"use client";

import {
  formatScanDate,
  formatScanDuration,
  getRiskLevelBadgeClass,
  getRiskLevelLabel,
  getStatusBadgeClass,
} from "@/lib/scan-history/utils";
import type { ScanHistoryRecord } from "@/lib/scan-history/types";
import { ScanHistoryActionsMenu } from "@/components/scan-history/ScanHistoryActionsMenu";

interface ScanHistoryTableProps {
  items: ScanHistoryRecord[];
  premiumUnlocked: boolean;
  actionBusy: boolean;
  onDownloadJson: (scan: ScanHistoryRecord) => void;
  onDownloadPdf: (scan: ScanHistoryRecord) => void;
  onDelete: (scan: ScanHistoryRecord) => void;
}

export function ScanHistoryTable({
  items,
  premiumUnlocked,
  actionBusy,
  onDownloadJson,
  onDownloadPdf,
  onDelete,
}: ScanHistoryTableProps) {
  return (
    <div className="hidden lg:block">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Scan history results</caption>
        <thead className="sticky top-0 z-[1] border-b border-border bg-scanonix-surface/95 text-table-header backdrop-blur-sm">
          <tr>
            <th scope="col" className="px-5 py-3.5 font-semibold">Target / File Name</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Type</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Risk Score</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Risk Level</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Scan Date</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Duration</th>
            <th scope="col" className="px-5 py-3.5 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((scan) => (
            <tr key={scan.id} className="transition-colors duration-150 hover:bg-surface-muted/60">
              <td className="max-w-[14rem] px-5 py-3.5 font-medium text-foreground xl:max-w-xs">
                <div className="truncate-url" title={scan.target}>
                  {scan.target}
                </div>
              </td>
              <td className="px-5 py-3.5 capitalize text-scanonix-muted">{scan.targetType}</td>
              <td className="px-5 py-3.5 font-semibold tabular-nums text-foreground">{scan.riskScore}</td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskLevelBadgeClass(scan.riskLevel)}`}
                >
                  {getRiskLevelLabel(scan.riskLevel)}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusBadgeClass(scan.status)}`}
                >
                  {scan.status}
                </span>
              </td>
              <td className="px-5 py-4 text-scanonix-muted">{formatScanDate(scan.createdAt)}</td>
              <td className="px-5 py-4 text-scanonix-muted">{formatScanDuration(scan.durationMs)}</td>
              <td className="px-5 py-3.5">
                <ScanHistoryActionsMenu
                  scan={scan}
                  premiumUnlocked={premiumUnlocked}
                  busy={actionBusy}
                  onDownloadJson={onDownloadJson}
                  onDownloadPdf={onDownloadPdf}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
