/**
 * Phase 132B-2 — monitor email dispatch verification.
 * NO real Resend calls. Run: npm run verify:monitor-email-132b
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMonitorAlertText,
  sendMonitorAlertEmail,
  isPlausibleEmailAddress,
} from "../lib/notifications/email";
import {
  FORBIDDEN_RECIPIENT_PAYLOAD_KEYS,
  claimPendingEmailNotification,
  processPendingEmailNotifications,
  type EmailDispatchAdmin,
  type PendingEmailQueueRow,
} from "../lib/monitors/notifications";

const root = process.cwd();

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

interface FakeRow {
  id: string;
  user_id: string;
  monitor_id: string | null;
  channel: string;
  status: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  processed_at: string | null;
}

class FakeAdmin implements EmailDispatchAdmin {
  rows: FakeRow[];
  emails: Record<string, string | null>;
  private chain: Promise<void> = Promise.resolve();

  constructor(rows: FakeRow[], emails: Record<string, string | null>) {
    this.rows = rows;
    this.emails = emails;
  }

  private enqueue<T>(fn: () => T): Promise<T> {
    const run = this.chain.then(() => fn());
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  auth = {
    admin: {
      getUserById: async (id: string) => {
        if (!(id in this.emails)) {
          return { data: { user: null }, error: { message: "not found" } };
        }
        const email = this.emails[id];
        return { data: { user: email ? { email } : { email: null } }, error: null };
      },
    },
  };

  from(relation: string) {
    const state: {
      op: "select" | "update";
      filters: Record<string, unknown>;
      values: Record<string, unknown> | null;
      single: boolean;
    } = { op: "select", filters: {}, values: null, single: false };

    const matches = (row: FakeRow) =>
      Object.entries(state.filters).every(([key, value]) => {
        if (key === "id") return row.id === value;
        if (key === "channel") return row.channel === value;
        if (key === "status") return row.status === value;
        return true;
      });

    const query = {
      select: () => query,
      update: (values: Record<string, unknown>) => {
        state.op = "update";
        state.values = values;
        return query;
      },
      eq: (column: string, value: unknown) => {
        state.filters[column] = value;
        return query;
      },
      order: () => query,
      limit: () => query,
      maybeSingle: () => {
        state.single = true;
        return query.execute();
      },
      then: (
        resolve: (value: { data: unknown; error: unknown }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => query.execute().then(resolve, reject),
      execute: () =>
        this.enqueue(() => {
          if (relation !== "notification_queue") {
            return { data: state.single ? null : [], error: null };
          }
          if (state.op === "select") {
            const data = this.rows.filter(matches).map((row) => ({ id: row.id }));
            return { data, error: null };
          }
          const row = this.rows.find(matches);
          if (!row || !state.values) {
            return { data: state.single ? null : [], error: null };
          }
          Object.assign(row, state.values);
          const view: PendingEmailQueueRow = {
            id: row.id,
            user_id: row.user_id,
            monitor_id: row.monitor_id,
            payload: row.payload,
            status: row.status,
          };
          return { data: state.single ? view : [view], error: null };
        }),
    };
    return query;
  }
}

const TEST_FROM = "alerts@scanonix.com";
const TEST_KEY = "re_test_not_a_real_key";
const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const MONITOR_ID = "22222222-2222-2222-2222-222222222222";
const QUEUE_ID = "33333333-3333-3333-3333-333333333333";

function pendingRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: QUEUE_ID,
    user_id: OWNER_ID,
    monitor_id: MONITOR_ID,
    channel: "email",
    status: "pending",
    payload: {
      email: "attacker@evil.example",
      to: "attacker@evil.example",
      targetUrl: "https://example.com",
      riskScore: 72,
      body: "1 new finding(s)",
    },
    error_message: null,
    processed_at: null,
    ...overrides,
  };
}

function jsonResponse(status: number): Response {
  return new Response("{}", { status });
}

async function main() {

const emailSource = readSource("lib/notifications/email.ts");
const notificationsSource = readSource("lib/monitors/notifications.ts");
const envSource = readSource("config/env.ts");
const envPublic = readSource("config/env.public.ts");
const migration = readSource("supabase/migrations/015_notification_queue_processing_and_rls.sql");
const migration010 = readSource("supabase/migrations/010_security_monitors.sql");
const cronSource = readSource("app/api/cron/monitors/run/route.ts");

// Transport A–G
{
  const sentTo: string[] = [];
  const ok = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    {
      apiKey: TEST_KEY,
      fromAddress: TEST_FROM,
      fetchImpl: async (url, init) => {
        sentTo.push(String(url));
        assert(
          "Q mock fetch only hits Resend URL shape",
          String(url) === "https://api.resend.com/emails",
        );
        assert("no log of key in body", !String(init?.body).includes(TEST_KEY));
        return jsonResponse(200);
      },
    },
  );
  assert("A 2xx → ok", ok.ok === true);
  assert("Q no extra URLs", sentTo.length === 1);
}

{
  const r400 = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    { apiKey: TEST_KEY, fromAddress: TEST_FROM, fetchImpl: async () => jsonResponse(400) },
  );
  assert("B 400 → not ok", r400.ok === false && r400.code === "provider_client_error");
}

{
  const r500 = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    { apiKey: TEST_KEY, fromAddress: TEST_FROM, fetchImpl: async () => jsonResponse(500) },
  );
  assert("C 500 → not ok", r500.ok === false && r500.code === "provider_server_error");
}

{
  const net = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    {
      apiKey: TEST_KEY,
      fromAddress: TEST_FROM,
      fetchImpl: async () => {
        throw new Error("ECONNRESET");
      },
    },
  );
  assert("D network → not ok", net.ok === false && net.code === "network_error");
}

{
  const timeout = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    {
      apiKey: TEST_KEY,
      fromAddress: TEST_FROM,
      fetchImpl: async (_url, init) => {
        const err = new Error("aborted");
        err.name = "AbortError";
        if (init?.signal?.aborted) throw err;
        throw err;
      },
    },
  );
  assert("E timeout/abort → not ok", timeout.ok === false && timeout.code === "timeout");
}

{
  const missingKey = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    { apiKey: "", fromAddress: TEST_FROM, fetchImpl: async () => jsonResponse(200) },
  );
  assert("F missing API key → not sent", missingKey.ok === false && missingKey.code === "missing_configuration");
}

{
  const missingFrom = await sendMonitorAlertEmail(
    { to: "owner@example.com", subject: "t", text: "b" },
    { apiKey: TEST_KEY, fromAddress: "", fetchImpl: async () => jsonResponse(200) },
  );
  assert("G missing from → not sent", missingFrom.ok === false && missingFrom.code === "missing_configuration");
}

assert("H invalid recipient rejected", !isPlausibleEmailAddress(""));
assert("H valid recipient accepted", isPlausibleEmailAddress("owner@example.com"));

// Dispatcher H / I / J / A
{
  const admin = new FakeAdmin([pendingRow()], { [OWNER_ID]: "owner@example.com" });
  let sendTo: string | null = null;
  const result = await processPendingEmailNotifications(20, {
    admin,
    isConfigured: () => true,
    lookupEmail: async (userId) => {
      assert("I lookup uses queue user_id", userId === OWNER_ID);
      return admin.emails[userId] ?? null;
    },
    send: async (input) => {
      sendTo = input.to;
      assert("J recipient is not payload attacker", input.to !== "attacker@evil.example");
      return { ok: true };
    },
  });
  assert("A dispatcher 2xx → sent", result.sent === 1 && admin.rows[0].status === "sent");
  assert("I/J send used auth email", sendTo === "owner@example.com");
  assert("M sent only after success", admin.rows[0].status === "sent" && result.failed === 0);
}

{
  const admin = new FakeAdmin([pendingRow()], { [OWNER_ID]: "owner@example.com" });
  const result = await processPendingEmailNotifications(20, {
    admin,
    isConfigured: () => true,
    lookupEmail: async () => "owner@example.com",
    send: async () => ({ ok: false, code: "provider_client_error" }),
  });
  assert("B/N 400 → failed not sent", result.sent === 0 && admin.rows[0].status === "failed");
}

{
  const admin = new FakeAdmin([pendingRow()], { [OWNER_ID]: "owner@example.com" });
  const result = await processPendingEmailNotifications(20, {
    admin,
    isConfigured: () => true,
    lookupEmail: async () => "owner@example.com",
    send: async () => ({ ok: false, code: "provider_server_error" }),
  });
  assert("C dispatcher 500 → failed", result.sent === 0 && admin.rows[0].status === "failed");
}

{
  const admin = new FakeAdmin([pendingRow()], { [OWNER_ID]: null });
  const result = await processPendingEmailNotifications(20, {
    admin,
    isConfigured: () => true,
    lookupEmail: async () => null,
    send: async () => {
      throw new Error("must not send");
    },
  });
  assert("H missing recipient → failed not sent", result.sent === 0 && admin.rows[0].status === "failed");
}

{
  const admin = new FakeAdmin([pendingRow()], { [OWNER_ID]: "owner@example.com" });
  const result = await processPendingEmailNotifications(20, {
    admin,
    isConfigured: () => false,
    send: async () => {
      throw new Error("must not send");
    },
  });
  assert(
    "F/G unconfigured leaves pending",
    result.sent === 0 && result.processed === 0 && admin.rows[0].status === "pending",
  );
}

// K concurrent claim
{
  const admin = new FakeAdmin([pendingRow()], { [OWNER_ID]: "owner@example.com" });
  const [first, second] = await Promise.all([
    claimPendingEmailNotification(admin, QUEUE_ID),
    claimPendingEmailNotification(admin, QUEUE_ID),
  ]);
  const winners = [first, second].filter(Boolean);
  assert("K only one concurrent claim wins", winners.length === 1);
  assert("L claimed row is processing", admin.rows[0].status === "processing");
}

{
  const admin = new FakeAdmin(
    [pendingRow({ status: "sent" })],
    { [OWNER_ID]: "owner@example.com" },
  );
  const claimed = await claimPendingEmailNotification(admin, QUEUE_ID);
  assert("L non-pending cannot be claimed", claimed === null);
}

{
  const content = buildMonitorAlertText(
    {
      targetUrl: "https://example.com/path",
      riskScore: 40,
      summary: "1 new finding(s)",
      monitorId: MONITOR_ID,
    },
    "https://www.scanonix.com",
  );
  assert("content is text/plain heading", content.text.includes("Scanonix monitor alert"));
  assert("content has risk", content.text.includes("40/100"));
  assert("content has target", content.text.includes("https://example.com/path"));
  assert("content has trusted link", content.text.includes("https://www.scanonix.com/monitors/"));
  assert("content omits user id", !content.text.includes(OWNER_ID));
}

// Source / migration / regression
assert("no stub false-sent", !notificationsSource.includes("Email dispatch stub"));
assert(
  "claim uses pending WHERE",
  notificationsSource.includes('.eq("status", "pending")') &&
    notificationsSource.includes('update({ status: "processing" })'),
);
assert(
  "sent only from processing",
  notificationsSource.includes('.eq("status", "processing")') &&
    notificationsSource.includes('status === "sent"'),
);
assert(
  "recipient from getUserById",
  notificationsSource.includes("auth.admin.getUserById") &&
    notificationsSource.includes("lookupEmail(claimed.user_id)"),
);
assert(
  "O in-app insert unchanged",
  notificationsSource.includes('channel: "in_app"') &&
    notificationsSource.includes("user_notifications"),
);
assert(
  "P webhook still queued not sent",
  notificationsSource.includes('channel: "webhook"') &&
    !notificationsSource.includes("processPendingWebhook"),
);
assert("Q transport uses Resend REST", emailSource.includes("https://api.resend.com/emails"));
assert("Q no resend package import", !emailSource.includes('from "resend"') && !emailSource.includes("from 'resend'"));
assert("R RESEND not in env.public", !envPublic.includes("RESEND_API_KEY"));
assert("R env.ts reads RESEND_API_KEY", envSource.includes('readEnv("RESEND_API_KEY")'));
assert("R no NEXT_PUBLIC_RESEND", !envSource.includes("NEXT_PUBLIC_RESEND"));
assert("015 forward-only processing CHECK", migration.includes("'pending', 'processing', 'sent', 'failed'"));
assert("015 enables RLS", migration.includes("enable row level security"));
assert("015 no client policies guessed", !/create policy/i.test(migration));
assert(
  "010 old migration untouched still has original check",
  migration010.includes("check (status in ('pending', 'sent', 'failed'))"),
);
assert("cron still calls processPendingEmailNotifications", cronSource.includes("processPendingEmailNotifications"));
assert(
  "S analytics helpers present",
  existsSync(join(root, "lib/analytics/ga4.ts")) &&
    readSource("lib/analytics/ga4.ts").includes("sanitizeGaPagePath") &&
    readSource("lib/analytics/monitor-create.ts").includes("createMonitorCreateAttempt"),
);
assert(
  "T billing success helper present",
  readSource("lib/analytics/subscription-complete.ts").includes("tryTrackSubscriptionComplete"),
);
assert(
  "forbidden payload keys documented",
  FORBIDDEN_RECIPIENT_PAYLOAD_KEYS.includes("email"),
);

console.log(`\n132B-2 monitor email verify: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
}

void main();
