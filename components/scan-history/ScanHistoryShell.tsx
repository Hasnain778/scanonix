"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { MotionSection } from "@/components/dashboard/dashboard-motion";
import { ScanHistoryDeleteDialog } from "@/components/scan-history/ScanHistoryDeleteDialog";
import {
  ScanHistoryEmptyState,
  ScanHistoryErrorState,
} from "@/components/scan-history/ScanHistoryEmptyState";
import {
  ScanHistoryFilters,
  type ScanHistoryFiltersState,
} from "@/components/scan-history/ScanHistoryFilters";
import { ScanHistoryHeader } from "@/components/scan-history/ScanHistoryHeader";
import { ScanHistoryMobileCards } from "@/components/scan-history/ScanHistoryMobileCards";
import { ScanHistorySkeleton } from "@/components/scan-history/ScanHistorySkeleton";
import { ScanHistorySummaryCards } from "@/components/scan-history/ScanHistorySummaryCards";
import { ScanHistoryTable } from "@/components/scan-history/ScanHistoryTable";
import {
  authorizeReportExport,
  deleteScanHistoryItem,
  fetchScanHistoryItem,
  fetchScanHistoryList,
  fetchScanHistorySummary,
} from "@/lib/scan-history/client";
import { SCAN_HISTORY_UPDATED_EVENT } from "@/lib/scan-history/events";
import type { ScanHistoryRecord, ScanHistorySummary } from "@/lib/scan-history/types";
import { downloadReportPdf } from "@/lib/scan-report/download-pdf";
import { serializeReportJson } from "@/lib/scan-report/utils";
import type { ScanReport } from "@/lib/scan-report/types";
import { fetchUsageSummary } from "@/lib/plan/client";

const DEFAULT_FILTERS: ScanHistoryFiltersState = {
  search: "",
  risk: "all",
  type: "all",
  date: "all",
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

export function ScanHistoryShell() {
  const [filters, setFilters] = useState<ScanHistoryFiltersState>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<ScanHistorySummary | null>(null);
  const [items, setItems] = useState<ScanHistoryRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScanHistoryRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      risk: filters.risk,
      type: filters.type,
      date: filters.date,
      dateFrom: filters.date === "custom" ? filters.dateFrom || undefined : undefined,
      dateTo: filters.date === "custom" ? filters.dateTo || undefined : undefined,
      sort: filters.sort,
    }),
    [page, debouncedSearch, filters],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!hasLoadedOnceRef.current) {
        setInitialLoading(true);
      } else {
        setListLoading(true);
      }
      setError(null);

      const [summaryResult, listResult, usageResult] = await Promise.all([
        fetchScanHistorySummary(),
        fetchScanHistoryList(query),
        fetchUsageSummary(),
      ]);

      if (cancelled) return;

      if (!summaryResult || "error" in listResult) {
        setError(("error" in listResult && listResult.error) || "Could not load scan history.");
        setInitialLoading(false);
        setListLoading(false);
        hasLoadedOnceRef.current = true;
        return;
      }

      setSummary(summaryResult);
      setItems(listResult.items);
      setTotalPages(listResult.totalPages);
      setTotal(listResult.total);
      setPremiumUnlocked(Boolean(usageResult?.allowPremiumAi));
      setInitialLoading(false);
      setListLoading(false);
      hasLoadedOnceRef.current = true;
    }

    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, reloadToken]);

  function updateFilters(next: Partial<ScanHistoryFiltersState>) {
    setPage(1);
    setFilters((current) => ({ ...current, ...next }));
  }

  function reloadHistory() {
    setReloadToken((current) => current + 1);
  }

  useEffect(() => {
    function handleScanHistoryUpdated() {
      reloadHistory();
    }

    window.addEventListener(SCAN_HISTORY_UPDATED_EVENT, handleScanHistoryUpdated);
    return () => {
      window.removeEventListener(SCAN_HISTORY_UPDATED_EVENT, handleScanHistoryUpdated);
    };
  }, []);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    const result = await deleteScanHistoryItem(deleteTarget.id);
    setDeleteLoading(false);

    if ("error" in result) {
      setNotice({ type: "error", message: result.error });
      return;
    }

    setNotice({ type: "success", message: "Scan deleted successfully." });
    setDeleteTarget(null);
    reloadHistory();
  }

  async function handleDownloadJson(scan: ScanHistoryRecord) {
    setActionBusy(true);
    setNotice(null);

    try {
      const auth = await authorizeReportExport("json");
      if ("error" in auth) {
        setNotice({
          type: "error",
          message:
            auth.status === 403
              ? "Upgrade to unlock premium reports."
              : auth.error,
        });
        return;
      }

      const result = await fetchScanHistoryItem(scan.id, true);
      if ("error" in result) {
        setNotice({ type: "error", message: result.error });
        return;
      }

      const report =
        (result.report as ScanReport | undefined) ??
        ({
          id: result.record.id,
          target: result.record.target,
          targetType: result.record.targetType,
          completedAt: result.record.createdAt,
          durationMs: result.record.durationMs,
          riskScore: result.record.riskScore,
          summary: {
            criticalIssues: 0,
            warnings: 0,
            passedChecks: 1,
            aiConfidence: 90,
          },
          findings: [],
          timeline: [],
          files: { scanned: 1, suspicious: 0, safe: 1, ignored: 0 },
          performance: {
            durationMs: result.record.durationMs,
            filesProcessed: 1,
            averageSpeedPerSecond: 1,
          },
        } satisfies ScanReport);

      const blob = new Blob([serializeReportJson(report)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `scanonix-report-${scan.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice({ type: "success", message: "JSON report downloaded." });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDownloadPdf(scan: ScanHistoryRecord) {
    setActionBusy(true);
    setNotice(null);

    try {
      const result = await downloadReportPdf(scan.id);

      if ("error" in result) {
        setNotice({
          type: "error",
          message:
            result.upgrade || result.status === 403
              ? "Upgrade to unlock premium reports."
              : result.error,
        });
        return;
      }

      setNotice({ type: "success", message: "PDF report downloaded." });
    } finally {
      setActionBusy(false);
    }
  }

  if (initialLoading) {
    return <ScanHistorySkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        <ScanHistoryHeader />
        <ScanHistoryErrorState onRetry={reloadHistory} />
      </div>
    );
  }

  const showEmpty = total === 0 && !debouncedSearch && filters.risk === "all" && filters.type === "all" && filters.date === "all";

  return (
    <div className="space-y-8">
      <MotionSection>
        <ScanHistoryHeader />
      </MotionSection>

      {notice ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {notice.message}
          {notice.type === "error" && notice.message.includes("Upgrade") ? (
            <Link href="/pricing" className="ml-2 font-semibold text-scanonix-orange hover:underline">
              View plans
            </Link>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <MotionSection delay={0.05}>
          <ScanHistorySummaryCards summary={summary} />
        </MotionSection>
      ) : null}

      {!showEmpty ? (
        <>
          <MotionSection delay={0.08}>
            <ScanHistoryFilters filters={filters} onChange={updateFilters} />
          </MotionSection>

          <MotionSection delay={0.1}>
            <section className="surface-card overflow-hidden" aria-busy={listLoading}>
              {listLoading ? (
                <div className="border-b border-white/8 px-5 py-3 text-sm text-scanonix-muted">
                  Updating results…
                </div>
              ) : null}

              {items.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-section-title">No scans match your filters</p>
                  <p className="text-body mt-2">
                    Try adjusting search, risk level, or date range.
                  </p>
                </div>
              ) : (
                <>
                  <ScanHistoryTable
                    items={items}
                    premiumUnlocked={premiumUnlocked}
                    actionBusy={actionBusy}
                    onDownloadJson={handleDownloadJson}
                    onDownloadPdf={handleDownloadPdf}
                    onDelete={setDeleteTarget}
                  />
                  <ScanHistoryMobileCards
                    items={items}
                    premiumUnlocked={premiumUnlocked}
                    actionBusy={actionBusy}
                    onDownloadJson={handleDownloadJson}
                    onDownloadPdf={handleDownloadPdf}
                    onDelete={setDeleteTarget}
                  />
                </>
              )}
            </section>
          </MotionSection>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-scanonix-muted">
                Page {page} of {totalPages} · {total} scans
              </p>
              <div className="flex gap-2">
                <ActionButton
                  variant="outline"
                  disabled={page <= 1 || listLoading}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </ActionButton>
                <ActionButton
                  variant="outline"
                  disabled={page >= totalPages || listLoading}
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                >
                  Next
                </ActionButton>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <ScanHistoryEmptyState />
      )}

      <ScanHistoryDeleteDialog
        scan={deleteTarget}
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}
