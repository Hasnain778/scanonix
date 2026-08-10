import { randomUUID } from "crypto";
import { isOpenAiConfigured } from "@/config/env";
import { enrichReportWithAiAnalysis } from "@/lib/ai/scan-analysis";
import { isAccountActive } from "@/lib/auth/admin";
import {
  buildMonitorSnapshot,
  detectMonitorChanges,
  hasSignificantChanges,
  hashFindings,
  snapshotFromJson,
} from "@/lib/monitors/change-detection";
import { dispatchMonitorNotifications } from "@/lib/monitors/notifications";
import { computeNextScanAt } from "@/lib/monitors/scheduler";
import type { MonitorChangeSet, MonitorEventType } from "@/lib/monitors/types";
import { getEffectivePlan } from "@/lib/auth/entitlements";
import { getPlanLimits } from "@/lib/plan/config";
import { runWebsiteScan } from "@/lib/scan/runner";
import { saveScanHistoryRecordForUser } from "@/lib/scan-history/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanReport } from "@/lib/scan-report/types";

const BATCH_SIZE = 5;

interface MonitorRow {
  id: string;
  user_id: string;
  target_url: string;
  frequency: "daily" | "weekly" | "monthly";
  last_risk_score: number | null;
  last_findings_hash: string | null;
  last_snapshot: unknown;
}

function buildEventsFromChanges(
  changes: MonitorChangeSet,
  riskScore: number,
): Array<{ eventType: MonitorEventType; severity: "info" | "warning" | "critical"; title: string; message: string }> {
  const events: Array<{ eventType: MonitorEventType; severity: "info" | "warning" | "critical"; title: string; message: string }> = [];

  for (const finding of changes.newFindings) {
    events.push({
      eventType: "new_vulnerability",
      severity: "warning",
      title: "New finding detected",
      message: finding,
    });
  }

  for (const finding of changes.resolvedFindings) {
    events.push({
      eventType: "resolved_vulnerability",
      severity: "info",
      title: "Finding resolved",
      message: finding,
    });
  }

  if (changes.riskScoreDelta !== null && changes.riskScoreDelta > 0) {
    events.push({
      eventType: "risk_increased",
      severity: changes.riskScoreDelta >= 15 ? "critical" : "warning",
      title: "Risk score increased",
      message: `Risk score increased by ${changes.riskScoreDelta} to ${riskScore}/100.`,
    });
  } else if (changes.riskScoreDelta !== null && changes.riskScoreDelta < 0) {
    events.push({
      eventType: "risk_decreased",
      severity: "info",
      title: "Risk score decreased",
      message: `Risk score decreased by ${Math.abs(changes.riskScoreDelta)} to ${riskScore}/100.`,
    });
  }

  for (const change of changes.headerChanges) {
    events.push({ eventType: "header_changed", severity: "warning", title: "Header change", message: change });
  }
  for (const change of changes.dnsChanges) {
    events.push({ eventType: "dns_changed", severity: "warning", title: "DNS change", message: change });
  }
  for (const change of changes.certificateChanges) {
    events.push({ eventType: "certificate_changed", severity: "warning", title: "Certificate change", message: change });
  }
  for (const change of changes.reputationChanges) {
    events.push({ eventType: "reputation_changed", severity: "info", title: "Reputation change", message: change });
  }

  return events;
}

export async function enqueueDueMonitors(limit = 50) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: dueMonitors, error } = await admin
    .from("security_monitors")
    .select("id, user_id")
    .eq("status", "active")
    .lte("next_scan_at", now)
    .limit(limit);

  if (error || !dueMonitors?.length) {
    return { enqueued: 0 };
  }

  let enqueued = 0;
  for (const monitor of dueMonitors) {
    const { data: existingJob } = await admin
      .from("monitor_job_queue")
      .select("id")
      .eq("monitor_id", monitor.id)
      .in("status", ["pending", "processing"])
      .maybeSingle();

    if (existingJob) continue;

    const { error: insertError } = await admin.from("monitor_job_queue").insert({
      monitor_id: monitor.id,
      user_id: monitor.user_id,
      status: "pending",
      scheduled_for: now,
    });

    if (!insertError) {
      enqueued += 1;
    } else if (insertError.code === "23505") {
      // Unique index prevents duplicate active jobs for the same monitor.
      continue;
    }
  }

  return { enqueued };
}

export async function processMonitorJobQueue(limit = BATCH_SIZE) {
  const admin = createAdminClient();

  const { data: jobs, error } = await admin
    .from("monitor_job_queue")
    .select("id, monitor_id, user_id, attempts")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error || !jobs?.length) {
    return { processed: 0, failures: 0 };
  }

  let processed = 0;
  let failures = 0;

  await Promise.allSettled(
    jobs.map(async (job) => {
      const { data: claimed, error: claimError } = await admin
        .from("monitor_job_queue")
        .update({
          status: "processing",
          attempts: (job.attempts ?? 0) + 1,
        })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (claimError || !claimed) {
        return;
      }

      try {
        await executeMonitorScan(job.monitor_id);
        await admin
          .from("monitor_job_queue")
          .update({ status: "completed", processed_at: new Date().toISOString() })
          .eq("id", job.id)
          .eq("status", "processing");
        processed += 1;
      } catch (err) {
        failures += 1;
        await admin
          .from("monitor_job_queue")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
            error_message: err instanceof Error ? err.message : "Monitor scan failed",
          })
          .eq("id", job.id)
          .eq("status", "processing");
      }
    }),
  );

  return { processed, failures };
}

export async function executeMonitorScan(monitorId: string) {
  const admin = createAdminClient();

  const { data: monitor, error } = await admin
    .from("security_monitors")
    .select("id, user_id, target_url, frequency, last_risk_score, last_findings_hash, last_snapshot, status")
    .eq("id", monitorId)
    .maybeSingle();

  if (error || !monitor) {
    throw new Error("Monitor not found");
  }

  const row = monitor as MonitorRow & { status: string };
  if (row.status !== "active") {
    return { skipped: true as const };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, status")
    .eq("id", row.user_id)
    .maybeSingle();

  if (!profile || !isAccountActive(profile as import("@/types/auth").Profile)) {
    throw new Error("Monitor owner account unavailable");
  }

  const plan = getEffectivePlan(profile as import("@/types/auth").Profile);
  const limits = getPlanLimits(plan);
  const scanId = randomUUID();
  const started = Date.now();

  let report: ScanReport | null = null;
  let errorMessage: string | null = null;

  try {
    report = await runWebsiteScan({ scanId, target: row.target_url });
    if (limits.allowPremiumAi && isOpenAiConfigured()) {
      report = await enrichReportWithAiAnalysis(report, { preferCloudAi: true });
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Scan failed";
  }

  const durationMs = Date.now() - started;
  const previousSnapshot = snapshotFromJson(row.last_snapshot);

  if (!report) {
    const { data: runRow } = await admin
      .from("monitor_runs")
      .insert({
        monitor_id: row.id,
        user_id: row.user_id,
        status: "failed",
        previous_risk_score: row.last_risk_score,
        error_message: errorMessage,
        duration_ms: durationMs,
      })
      .select("id")
      .single();

    await admin.from("monitor_events").insert({
      monitor_id: row.id,
      monitor_run_id: runRow?.id ?? null,
      user_id: row.user_id,
      event_type: "scan_failed",
      severity: "warning",
      title: "Scheduled scan failed",
      message: errorMessage ?? "Unknown error",
    });

    await admin
      .from("security_monitors")
      .update({ next_scan_at: computeNextScanAt(row.frequency) })
      .eq("id", row.id);

    return { failed: true as const };
  }

  const snapshot = buildMonitorSnapshot(report);
  const changes = detectMonitorChanges(previousSnapshot, snapshot, report);

  const saveResult = await saveScanHistoryRecordForUser(row.user_id, {
    scanId,
    target: report.target,
    targetType: "website",
    riskScore: report.riskScore,
    status: "completed",
    durationMs,
    findingsCount: report.findings.filter((f) => f.severity !== "info").length,
    report,
  });

  if ("error" in saveResult) {
    throw new Error(saveResult.message ?? "Failed to save scan history");
  }

  const { data: runRow } = await admin
    .from("monitor_runs")
    .insert({
      monitor_id: row.id,
      user_id: row.user_id,
      scan_history_id: saveResult.record.id,
      status: "completed",
      risk_score: report.riskScore,
      previous_risk_score: row.last_risk_score,
      findings_hash: hashFindings(report),
      snapshot,
      changes,
      duration_ms: durationMs,
    })
    .select("id")
    .single();

  const timelineEvents = buildEventsFromChanges(changes, report.riskScore);
  if (timelineEvents.length === 0) {
    timelineEvents.push({
      eventType: "scan_completed",
      severity: "info",
      title: "Scheduled scan completed",
      message: `No significant changes detected. Risk score: ${report.riskScore}/100.`,
    });
  }

  await admin.from("monitor_events").insert(
    timelineEvents.map((event) => ({
      monitor_id: row.id,
      monitor_run_id: runRow?.id ?? null,
      user_id: row.user_id,
      event_type: event.eventType,
      severity: event.severity,
      title: event.title,
      message: event.message,
      payload: { changes },
    })),
  );

  await admin
    .from("security_monitors")
    .update({
      last_scan_at: new Date().toISOString(),
      next_scan_at: computeNextScanAt(row.frequency),
      last_scan_id: saveResult.record.id,
      last_risk_score: report.riskScore,
      last_findings_hash: snapshot.findingsHash,
      last_snapshot: snapshot,
    })
    .eq("id", row.id);

  if (hasSignificantChanges(changes)) {
    const prefs = await getNotificationPreferencesForUser(row.user_id);
    await dispatchMonitorNotifications({
      userId: row.user_id,
      monitorId: row.id,
      targetUrl: row.target_url,
      changes,
      riskScore: report.riskScore,
      prefs,
    });
  }

  return { completed: true as const, scanId: saveResult.record.id };
}

async function getNotificationPreferencesForUser(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_notification_preferences")
    .select("scan_completed, high_risk_found")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    scan_completed: data?.scan_completed ?? true,
    high_risk_found: data?.high_risk_found ?? true,
  };
}

export async function runMonitorScheduler() {
  const enqueue = await enqueueDueMonitors();
  const process = await processMonitorJobQueue();
  return { ...enqueue, ...process };
}
