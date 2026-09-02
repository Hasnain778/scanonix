import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/config/env";
import type { MonitorChangeSet, MonitorEventType, NotificationChannel } from "@/lib/monitors/types";
import {
  buildMonitorAlertText,
  isMonitorEmailConfigured,
  isPlausibleEmailAddress,
  sendMonitorAlertEmail,
  type EmailFailureCode,
} from "@/lib/notifications/email";

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

export interface PendingEmailQueueRow {
  id: string;
  user_id: string;
  monitor_id: string | null;
  payload: Record<string, unknown>;
  status: string;
}

/** Payload keys that must never be used as the recipient. */
export const FORBIDDEN_RECIPIENT_PAYLOAD_KEYS = [
  "email",
  "to",
  "recipient",
  "recipient_email",
  "user_email",
] as const;

/**
 * Atomic claim: UPDATE ... WHERE id AND status='pending' RETURNING.
 * Only one concurrent worker can win for a given row.
 */
export interface ProcessEmailNotificationsDeps {
  admin?: EmailDispatchAdmin;
  send?: typeof sendMonitorAlertEmail;
  lookupEmail?: (userId: string) => Promise<string | null>;
  isConfigured?: () => boolean;
}

export type EmailDispatchAdmin = {
  from: (relation: string) => EmailDispatchQuery;
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: { email?: string | null } | null };
        error: unknown;
      }>;
    };
  };
};

export type EmailDispatchQuery = {
  select: (columns: string) => EmailDispatchQuery;
  update: (values: Record<string, unknown>) => EmailDispatchQuery;
  eq: (column: string, value: unknown) => EmailDispatchQuery;
  order: (column: string, options: { ascending: boolean }) => EmailDispatchQuery;
  limit: (count: number) => EmailDispatchQuery;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

export async function claimPendingEmailNotification(
  admin: EmailDispatchAdmin,
  id: string,
): Promise<PendingEmailQueueRow | null> {
  const { data, error } = await admin
    .from("notification_queue")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("channel", "email")
    .eq("status", "pending")
    .select("id, user_id, monitor_id, payload, status")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as PendingEmailQueueRow;
}

export async function lookupAuthUserEmail(
  admin: EmailDispatchAdmin,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) {
    return null;
  }
  return data.user.email;
}

export interface ProcessEmailNotificationsResult {
  processed: number;
  sent: number;
  failed: number;
  skippedUnconfigured: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function markEmailTerminal(
  admin: EmailDispatchAdmin,
  id: string,
  status: "sent" | "failed",
  errorCode?: EmailFailureCode | "missing_recipient",
) {
  await admin
    .from("notification_queue")
    .update({
      status,
      processed_at: nowIso(),
      error_message: status === "sent" ? null : (errorCode ?? "failed"),
    })
    .eq("id", id)
    .eq("status", "processing");
}

/**
 * Deliver pending monitor alert emails.
 * Failed rows are terminal in 132B-2 (no automatic retry scheduler).
 * Missing provider config leaves rows pending (not sent).
 */
export async function processPendingEmailNotifications(
  limit = 20,
  deps: ProcessEmailNotificationsDeps = {},
): Promise<ProcessEmailNotificationsResult> {
  const result: ProcessEmailNotificationsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skippedUnconfigured: 0,
  };

  try {
    const configured = deps.isConfigured ?? isMonitorEmailConfigured;
    if (!configured()) {
      return result;
    }

    const admin = (deps.admin ?? createAdminClient()) as EmailDispatchAdmin;
    const send = deps.send ?? sendMonitorAlertEmail;
    const lookupEmail =
      deps.lookupEmail ?? ((userId: string) => lookupAuthUserEmail(admin, userId));

    const { data, error } = (await admin
      .from("notification_queue")
      .select("id")
      .eq("channel", "email")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit)) as { data: Array<{ id: string }> | null; error: unknown };

    if (error || !data?.length) {
      return result;
    }

    for (const row of data) {
      const claimed = await claimPendingEmailNotification(admin, row.id);
      if (!claimed) {
        continue;
      }
      result.processed += 1;

      const recipient = await lookupEmail(claimed.user_id);
      if (!isPlausibleEmailAddress(recipient)) {
        await markEmailTerminal(admin, claimed.id, "failed", "missing_recipient");
        result.failed += 1;
        continue;
      }

      const summary =
        typeof claimed.payload?.body === "string"
          ? claimed.payload.body
          : typeof claimed.payload?.subject === "string"
            ? claimed.payload.subject
            : undefined;

      const content = buildMonitorAlertText(
        {
          targetUrl: claimed.payload?.targetUrl,
          riskScore: claimed.payload?.riskScore,
          summary,
          monitorId: claimed.monitor_id ?? claimed.payload?.monitorId,
        },
        env.siteUrl,
      );

      const sendResult = await send({
        to: recipient,
        subject: content.subject,
        text: content.text,
      });

      if (sendResult.ok) {
        await markEmailTerminal(admin, claimed.id, "sent");
        result.sent += 1;
      } else {
        await markEmailTerminal(admin, claimed.id, "failed", sendResult.code);
        result.failed += 1;
      }
    }

    return result;
  } catch (error) {
    console.error(
      "Monitor email dispatch failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return result;
  }
}

