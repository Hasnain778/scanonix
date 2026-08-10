import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanReport } from "@/lib/scan-report/types";
import type {
  ScanDateFilter,
  ScanHistoryQuery,
  ScanHistoryRow,
  ScanHistorySummary,
  ScanHistorySummaryRow,
  SaveScanHistoryInput,
  SaveScanHistoryResult,
  ScanRiskFilter,
  ScanSortOption,
  ScanTypeFilter,
} from "@/lib/scan-history/types";
import { mapScanHistoryRow } from "@/lib/scan-history/utils";

const LIST_COLUMNS =
  "id, user_id, target, target_type, risk_score, status, duration_ms, findings_count, error_message, scan_token, created_at, updated_at";

export async function requireScanHistoryUser() {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }
  return user;
}

function getDateRange(date: ScanDateFilter, dateFrom?: string, dateTo?: string) {
  const now = new Date();

  if (date === "today") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (date === "7d") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (date === "30d") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    return { from: start.toISOString(), to: now.toISOString() };
  }

  if (date === "custom" && dateFrom) {
    return {
      from: new Date(dateFrom).toISOString(),
      to: dateTo ? new Date(dateTo).toISOString() : now.toISOString(),
    };
  }

  return null;
}

function applyRiskFilter(risk: ScanRiskFilter) {
  switch (risk) {
    case "low":
      return { min: 0, max: 25, status: "completed" as const };
    case "medium":
      return { min: 26, max: 50, status: "completed" as const };
    case "high":
      return { min: 51, max: 75, status: "completed" as const };
    case "critical":
      return { min: 76, max: 100, status: "completed" as const };
    case "clean":
      return { min: 0, max: 25, status: "completed" as const };
    case "failed":
      return { status: "failed" as const };
    default:
      return null;
  }
}

function getSortColumn(sort: ScanSortOption): { column: string; ascending: boolean } {
  switch (sort) {
    case "oldest":
      return { column: "created_at", ascending: true };
    case "highest_risk":
      return { column: "risk_score", ascending: false };
    case "lowest_risk":
      return { column: "risk_score", ascending: true };
    case "newest":
    default:
      return { column: "created_at", ascending: false };
  }
}

export async function listScanHistory(query: ScanHistoryQuery) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();
  let request = supabase
    .from("scan_history")
    .select(LIST_COLUMNS, { count: "exact" });

  const search = query.search?.trim();
  if (search) {
    const uuidPattern = /^[0-9a-f-]{36}$/i.test(search);
    if (uuidPattern) {
      request = request.eq("id", search);
    } else {
      request = request.ilike("target", `%${search}%`);
    }
  }

  const type = (query.type ?? "all") as ScanTypeFilter;
  if (type === "website" || type === "file") {
    request = request.eq("target_type", type);
  }

  const riskFilter = applyRiskFilter((query.risk ?? "all") as ScanRiskFilter);
  if (riskFilter?.status === "failed") {
    request = request.eq("status", "failed");
  } else if (riskFilter?.status === "completed") {
    request = request
      .eq("status", "completed")
      .gte("risk_score", riskFilter.min ?? 0)
      .lte("risk_score", riskFilter.max ?? 100);
  }

  const dateRange = getDateRange(
    (query.date ?? "all") as ScanDateFilter,
    query.dateFrom,
    query.dateTo,
  );
  if (dateRange) {
    request = request.gte("created_at", dateRange.from).lte("created_at", dateRange.to);
  }

  const sort = getSortColumn((query.sort ?? "newest") as ScanSortOption);
  request = request.order(sort.column, { ascending: sort.ascending });

  const { data, error, count } = await request.range(from, to);

  if (error) {
    return { error: "query_failed" as const, message: error.message };
  }

  const total = count ?? 0;
  const rows = (data ?? []) as ScanHistoryRow[];

  return {
    items: rows.map(mapScanHistoryRow),
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

export async function getScanHistorySummary(): Promise<
  ScanHistorySummary | { error: "unauthorized" | "query_failed"; message?: string }
> {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_scan_history_summary");

  if (error) {
    return { error: "query_failed", message: error.message };
  }

  const summary = data as ScanHistorySummaryRow;

  return {
    totalScans: summary.total_scans ?? 0,
    highRiskScans: summary.high_risk_scans ?? 0,
    cleanScans: summary.clean_scans ?? 0,
    averageRiskScore: summary.average_risk_score ?? 0,
  };
}

export async function getOwnedScanById(id: string, includeReport = false) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const supabase = await createClient();
  const { data, error } = includeReport
    ? await supabase
        .from("scan_history")
        .select(`${LIST_COLUMNS}, report_data`)
        .eq("id", id)
        .maybeSingle()
    : await supabase
        .from("scan_history")
        .select(LIST_COLUMNS)
        .eq("id", id)
        .maybeSingle();

  if (error) {
    return { error: "query_failed" as const, message: error.message };
  }

  if (!data) {
    return { error: "not_found" as const };
  }

  const row = data as unknown as ScanHistoryRow;
  const record = mapScanHistoryRow(row);

  let report: ScanReport | null = null;
  if (includeReport && row.report_data && typeof row.report_data === "object") {
    report = row.report_data as ScanReport;
  }

  return { record, report, userId: user.id };
}

export async function deleteOwnedScan(id: string) {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scan_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "delete_failed" as const, message: error.message };
  }

  if (!data) {
    return { error: "not_found" as const };
  }

  return { ok: true as const };
}

export async function saveScanHistoryRecord(
  input: SaveScanHistoryInput,
): Promise<
  SaveScanHistoryResult | { error: "unauthorized" | "insert_failed"; message?: string }
> {
  const user = await requireScanHistoryUser();
  if (!user) {
    return { error: "unauthorized" };
  }

  const supabase = await createClient();
  const { data: existingByToken } = await supabase
    .from("scan_history")
    .select(`${LIST_COLUMNS}, report_data`)
    .eq("user_id", user.id)
    .eq("scan_token", input.scanId)
    .maybeSingle();

  if (existingByToken) {
    const row = existingByToken as unknown as ScanHistoryRow;
    return {
      record: mapScanHistoryRow(row),
      report:
        row.report_data && typeof row.report_data === "object"
          ? (row.report_data as ScanReport)
          : null,
      duplicate: true,
    };
  }

  const { data: existingById } = await supabase
    .from("scan_history")
    .select(`${LIST_COLUMNS}, report_data`)
    .eq("user_id", user.id)
    .eq("id", input.scanId)
    .maybeSingle();

  if (existingById) {
    const row = existingById as unknown as ScanHistoryRow;
    return {
      record: mapScanHistoryRow(row),
      report:
        row.report_data && typeof row.report_data === "object"
          ? (row.report_data as ScanReport)
          : null,
      duplicate: true,
    };
  }

  const report =
    input.report && input.status === "completed"
      ? { ...input.report, id: input.scanId }
      : null;

  const { data, error } = await supabase
    .from("scan_history")
    .insert({
      id: input.scanId,
      user_id: user.id,
      target: input.target,
      target_type: input.targetType,
      risk_score: input.riskScore,
      status: input.status,
      duration_ms: input.durationMs,
      findings_count: input.findingsCount,
      error_message: input.errorMessage ?? null,
      scan_token: input.scanId,
      report_data: report,
    })
    .select(LIST_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      const owned = await getOwnedScanById(input.scanId, true);
      if (!("error" in owned)) {
        return {
          record: owned.record,
          report: owned.report,
          duplicate: true,
        };
      }
    }

    return { error: "insert_failed", message: error.message };
  }

  return {
    record: mapScanHistoryRow(data as unknown as ScanHistoryRow),
    report,
    duplicate: false,
  };
}

/** Service-role save for scheduled monitor scans (cron/background jobs). */
export async function saveScanHistoryRecordForUser(
  userId: string,
  input: SaveScanHistoryInput,
): Promise<
  SaveScanHistoryResult | { error: "insert_failed"; message?: string }
> {
  const admin = createAdminClient();

  const { data: existingByToken } = await admin
    .from("scan_history")
    .select(`${LIST_COLUMNS}, report_data`)
    .eq("user_id", userId)
    .eq("scan_token", input.scanId)
    .maybeSingle();

  if (existingByToken) {
    const row = existingByToken as unknown as ScanHistoryRow;
    return {
      record: mapScanHistoryRow(row),
      report:
        row.report_data && typeof row.report_data === "object"
          ? (row.report_data as ScanReport)
          : null,
      duplicate: true,
    };
  }

  const report =
    input.report && input.status === "completed"
      ? { ...input.report, id: input.scanId }
      : null;

  const { data, error } = await admin
    .from("scan_history")
    .insert({
      id: input.scanId,
      user_id: userId,
      target: input.target,
      target_type: input.targetType,
      risk_score: input.riskScore,
      status: input.status,
      duration_ms: input.durationMs,
      findings_count: input.findingsCount,
      error_message: input.errorMessage ?? null,
      scan_token: input.scanId,
      report_data: report,
    })
    .select(LIST_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("scan_history")
        .select(`${LIST_COLUMNS}, report_data`)
        .eq("user_id", userId)
        .eq("scan_token", input.scanId)
        .maybeSingle();

      if (existing) {
        const row = existing as unknown as ScanHistoryRow;
        return {
          record: mapScanHistoryRow(row),
          report:
            row.report_data && typeof row.report_data === "object"
              ? (row.report_data as ScanReport)
              : null,
          duplicate: true,
        };
      }
    }

    return { error: "insert_failed", message: error.message };
  }

  return {
    record: mapScanHistoryRow(data as unknown as ScanHistoryRow),
    report,
    duplicate: false,
  };
}
