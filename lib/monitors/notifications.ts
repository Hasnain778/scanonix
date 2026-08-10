import { createAdminClient } from "@/lib/supabase/admin";
import type { MonitorChangeSet, MonitorEventType, NotificationChannel } from "@/lib/monitors/types";

interface QueueNotificationInput {
  userId: string;
  monitorId: string;
  channel: NotificationChannel;
  eventType: MonitorEventType | string;
  payload: Record<string, unknown>;
}

export async function queueNotification(input: QueueNotificationInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("notification_queue").insert({
    user_id: input.userId,
    monitor_id: input.monitorId,
    channel: input.channel,
    event_type: input.eventType,
    payload: input.payload,
    status: "pending",
  });

  if (error) {
    console.error("Failed to queue notification:", error.message);
  }
}

export async function createInAppNotification(input: {
  userId: string;
  monitorId: string;
  title: string;
  message: string;
  link?: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("user_notifications").insert({
    user_id: input.userId,
    monitor_id: input.monitorId,
    title: input.title,
    message: input.message,
    link: input.link ?? `/monitors/${input.monitorId}`,
    read: false,
  });

  if (error) {
    console.error("Failed to create in-app notification:", error.message);
  }
}

export async function dispatchMonitorNotifications(input: {
  userId: string;
  monitorId: string;
  targetUrl: string;
  changes: MonitorChangeSet;
  riskScore: number;
  prefs: {
    scan_completed: boolean;
    high_risk_found: boolean;
  };
}) {
  const summaryParts: string[] = [];
  if (input.changes.newFindings.length) {
    summaryParts.push(`${input.changes.newFindings.length} new finding(s)`);
  }
  if (input.changes.resolvedFindings.length) {
    summaryParts.push(`${input.changes.resolvedFindings.length} resolved finding(s)`);
  }
  if (input.changes.riskScoreDelta) {
    summaryParts.push(`risk score ${input.changes.riskScoreDelta > 0 ? "increased" : "decreased"} by ${Math.abs(input.changes.riskScoreDelta)}`);
  }

  const title = `Security change detected — ${input.targetUrl}`;
  const message =
    summaryParts.length > 0
      ? summaryParts.join("; ")
      : `Scheduled scan completed with risk score ${input.riskScore}/100.`;

  const payload = {
    monitorId: input.monitorId,
    targetUrl: input.targetUrl,
    riskScore: input.riskScore,
    changes: input.changes,
  };

  const significant =
    input.changes.newFindings.length > 0 ||
    (input.changes.riskScoreDelta !== null && input.changes.riskScoreDelta > 0);

  if (input.prefs.scan_completed || (significant && input.prefs.high_risk_found)) {
    await createInAppNotification({
      userId: input.userId,
      monitorId: input.monitorId,
      title,
      message,
    });

    await queueNotification({
      userId: input.userId,
      monitorId: input.monitorId,
      channel: "in_app",
      eventType: significant ? "risk_increased" : "scan_completed",
      payload,
    });
  }

  if (input.prefs.high_risk_found && significant) {
    await queueNotification({
      userId: input.userId,
      monitorId: input.monitorId,
      channel: "email",
      eventType: "monitor_alert",
      payload: { ...payload, subject: title, body: message },
    });
  }

  await queueNotification({
    userId: input.userId,
    monitorId: input.monitorId,
    channel: "webhook",
    eventType: significant ? "monitor.change_detected" : "monitor.scan_completed",
    payload,
  });
}

export async function processPendingEmailNotifications(limit = 20) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_queue")
    .select("id, payload, event_type")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data?.length) return { processed: 0 };

  for (const row of data) {
    // Email provider not configured — mark as sent with note for future Resend/SendGrid integration
    await admin
      .from("notification_queue")
      .update({
        status: "sent",
        processed_at: new Date().toISOString(),
        error_message: "Email dispatch stub — configure provider in lib/notifications/email.ts",
      })
      .eq("id", row.id);
  }

  return { processed: data.length };
}
