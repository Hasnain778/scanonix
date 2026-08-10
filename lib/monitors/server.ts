import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type {
  CreateMonitorInput,
  MonitorEventRecord,
  MonitorFrequency,
  MonitorRunRecord,
  MonitorSummary,
  SecurityMonitorRecord,
} from "@/lib/monitors/types";
import { computeNextScanAt, normalizeMonitorUrl } from "@/lib/monitors/scheduler";
import { changesFromJson, snapshotFromJson } from "@/lib/monitors/change-detection";

const MONITOR_COLUMNS =
  "id, user_id, target_url, label, frequency, status, last_scan_at, next_scan_at, last_scan_id, last_risk_score, last_findings_hash, created_at, updated_at";

function mapMonitor(row: Record<string, unknown>): SecurityMonitorRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    targetUrl: row.target_url as string,
    label: (row.label as string | null) ?? null,
    frequency: row.frequency as MonitorFrequency,
    status: row.status as SecurityMonitorRecord["status"],
    lastScanAt: (row.last_scan_at as string | null) ?? null,
    nextScanAt: (row.next_scan_at as string | null) ?? null,
    lastScanId: (row.last_scan_id as string | null) ?? null,
    lastRiskScore: (row.last_risk_score as number | null) ?? null,
    lastFindingsHash: (row.last_findings_hash as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRun(row: Record<string, unknown>): MonitorRunRecord {
  return {
    id: row.id as string,
    monitorId: row.monitor_id as string,
    userId: row.user_id as string,
    scanHistoryId: (row.scan_history_id as string | null) ?? null,
    status: row.status as MonitorRunRecord["status"],
    riskScore: (row.risk_score as number | null) ?? null,
    previousRiskScore: (row.previous_risk_score as number | null) ?? null,
    findingsHash: (row.findings_hash as string | null) ?? null,
    changes: changesFromJson(row.changes),
    errorMessage: (row.error_message as string | null) ?? null,
    durationMs: (row.duration_ms as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

function mapEvent(row: Record<string, unknown>): MonitorEventRecord {
  return {
    id: row.id as string,
    monitorId: row.monitor_id as string,
    monitorRunId: (row.monitor_run_id as string | null) ?? null,
    userId: row.user_id as string,
    eventType: row.event_type as MonitorEventRecord["eventType"],
    severity: row.severity as MonitorEventRecord["severity"],
    title: row.title as string,
    message: row.message as string,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function requireMonitorUser() {
  return getAuthUser();
}

export async function listMonitors() {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("security_monitors")
    .select(MONITOR_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { error: "query_failed" as const, message: error.message };
  return { monitors: (data ?? []).map(mapMonitor) };
}

export async function getOwnedMonitor(monitorId: string) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("security_monitors")
    .select(MONITOR_COLUMNS)
    .eq("id", monitorId)
    .maybeSingle();

  if (error) return { error: "query_failed" as const, message: error.message };
  if (!data) return { error: "not_found" as const };
  return { monitor: mapMonitor(data) };
}

export async function countUserMonitors(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("security_monitors")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

export async function createMonitor(input: CreateMonitorInput) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const targetUrl = normalizeMonitorUrl(input.targetUrl);
  const nextScanAt = computeNextScanAt(input.frequency);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("security_monitors")
    .insert({
      user_id: user.id,
      target_url: targetUrl,
      label: input.label?.trim() || null,
      frequency: input.frequency,
      status: "active",
      next_scan_at: nextScanAt,
    })
    .select(MONITOR_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "duplicate" as const, message: "This URL is already being monitored." };
    }
    return { error: "insert_failed" as const, message: error.message };
  }

  return { monitor: mapMonitor(data) };
}

export async function updateMonitorStatus(monitorId: string, status: "active" | "paused") {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const updates: {
    status: "active" | "paused";
    next_scan_at?: string;
  } = { status };
  if (status === "active") {
    const owned = await getOwnedMonitor(monitorId);
    if ("monitor" in owned && owned.monitor && !owned.monitor.nextScanAt) {
      updates.next_scan_at = computeNextScanAt(owned.monitor.frequency);
    }
  }

  const { data, error } = await supabase
    .from("security_monitors")
    .update(updates)
    .eq("id", monitorId)
    .select(MONITOR_COLUMNS)
    .single();

  if (error) return { error: "update_failed" as const, message: error.message };
  if (!data) return { error: "not_found" as const };
  return { monitor: mapMonitor(data) };
}

export async function updateMonitorFrequency(monitorId: string, frequency: MonitorFrequency) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("security_monitors")
    .update({
      frequency,
      next_scan_at: computeNextScanAt(frequency),
    })
    .eq("id", monitorId)
    .select(MONITOR_COLUMNS)
    .single();

  if (error) return { error: "update_failed" as const, message: error.message };
  if (!data) return { error: "not_found" as const };
  return { monitor: mapMonitor(data) };
}

export async function deleteMonitor(monitorId: string) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { error } = await supabase.from("security_monitors").delete().eq("id", monitorId);
  if (error) return { error: "delete_failed" as const, message: error.message };
  return { ok: true as const };
}

export async function getMonitorSummary(): Promise<MonitorSummary | { error: string }> {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" };

  const supabase = await createClient();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const [monitorsRes, eventsRes] = await Promise.all([
    supabase.from("security_monitors").select("status"),
    supabase
      .from("monitor_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString())
      .in("severity", ["warning", "critical"]),
  ]);

  const monitors = monitorsRes.data ?? [];
  return {
    totalMonitors: monitors.length,
    activeMonitors: monitors.filter((m) => m.status === "active").length,
    pausedMonitors: monitors.filter((m) => m.status === "paused").length,
    alertsThisWeek: eventsRes.count ?? 0,
  };
}

export async function listMonitorRuns(monitorId: string, limit = 30) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monitor_runs")
    .select("*")
    .eq("monitor_id", monitorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: "query_failed" as const, message: error.message };
  return { runs: (data ?? []).map(mapRun) };
}

export async function listMonitorEvents(monitorId: string, limit = 50) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monitor_events")
    .select("*")
    .eq("monitor_id", monitorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: "query_failed" as const, message: error.message };
  return { events: (data ?? []).map(mapEvent) };
}

export async function listUserNotifications(limit = 30) {
  const user = await requireMonitorUser();
  if (!user) return { error: "unauthorized" as const };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: "query_failed" as const, message: error.message };

  return {
    notifications: (data ?? []).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      monitorId: (row.monitor_id as string | null) ?? null,
      title: row.title as string,
      message: row.message as string,
      link: (row.link as string | null) ?? null,
      read: Boolean(row.read),
      createdAt: row.created_at as string,
    })),
  };
}

export { snapshotFromJson };
