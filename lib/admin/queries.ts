import {
  isDomainReputationProviderConfigured,
  isOpenAiConfigured,
  isStripeConfigured,
  isSupabaseConfigured,
} from "@/config/env";
import type {
  AdminAnalyticsData,
  AdminDashboardStats,
  AdminMonitoringStats,
  AdminScanRow,
  AdminSubscriptionStats,
  AdminSystemStatus,
  AdminUserRow,
} from "@/lib/admin/types";
import { estimateMrrFromPriceId } from "@/lib/admin/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanReportFinding } from "@/lib/scan-report/types";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

async function listAuthEmails(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const map = new Map<string, string>();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) break;
    for (const user of data.users) {
      if (user.email) map.set(user.id, user.email);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return map;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const admin = createAdminClient();
  const since7 = daysAgoIso(7);
  const since30 = daysAgoIso(30);

  const [
    profilesRes,
    scansRes,
    scans7Res,
    scans30Res,
    websiteRes,
    fileRes,
    usageRes,
    recentScansRes,
  ] = await Promise.all([
    admin.from("profiles").select("id, plan, country, subscription_status, subscription_price_id, status, role", { count: "exact" }),
    admin.from("scan_history").select("id, status, risk_score, report_data", { count: "exact" }),
    admin.from("scan_history").select("user_id").gte("created_at", since7),
    admin.from("scan_history").select("user_id").gte("created_at", since30),
    admin.from("scan_history").select("id", { count: "exact", head: true }).eq("target_type", "website"),
    admin.from("scan_history").select("id", { count: "exact", head: true }).eq("target_type", "file"),
    admin.from("usage_counters").select("usage_count"),
    admin.from("scan_history").select("report_data, user_id").order("created_at", { ascending: false }).limit(300),
  ]);

  const profiles = profilesRes.data ?? [];
  const scans = scansRes.data ?? [];
  const totalUsers = profilesRes.count ?? profiles.length;
  const totalScans = scansRes.count ?? scans.length;

  const active7 = new Set((scans7Res.data ?? []).map((row) => row.user_id)).size;
  const active30 = new Set((scans30Res.data ?? []).map((row) => row.user_id)).size;

  const completed = scans.filter((s) => s.status === "completed").length;
  const riskScores = scans.filter((s) => typeof s.risk_score === "number").map((s) => s.risk_score as number);
  const averageRiskScore =
    riskScores.length > 0
      ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
      : 0;

  const premiumSubscribers = profiles.filter(
    (p) =>
      (p.plan === "pro" || p.plan === "business") &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(p.subscription_status ?? ""),
  ).length;

  const monthlyRevenueGbp = profiles
    .filter((p) => ACTIVE_SUBSCRIPTION_STATUSES.has(p.subscription_status ?? ""))
    .reduce((sum, p) => sum + estimateMrrFromPriceId(p.subscription_price_id), 0);

  const countryCounts = new Map<string, number>();
  for (const profile of profiles) {
    const country = profile.country?.trim() || "Unknown";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  const findingCounts = new Map<string, number>();
  for (const scan of recentScansRes.data ?? []) {
    const report = scan.report_data as { findings?: ScanReportFinding[] } | null;
    for (const finding of report?.findings ?? []) {
      if (finding.severity === "info") continue;
      findingCounts.set(finding.title, (findingCounts.get(finding.title) ?? 0) + 1);
    }
  }

  const apiUsageTotal = (usageRes.data ?? []).reduce((sum, row) => sum + (row.usage_count ?? 0), 0);

  let storageUsageBytes = 0;
  for (const scan of recentScansRes.data ?? []) {
    if (scan.report_data) {
      storageUsageBytes += JSON.stringify(scan.report_data).length;
    }
  }

  return {
    totalUsers,
    activeUsers7d: active7,
    activeUsers30d: active30,
    totalScans,
    websiteScans: websiteRes.count ?? 0,
    fileScans: fileRes.count ?? 0,
    averageRiskScore,
    premiumSubscribers,
    monthlyRevenueGbp: Math.round(monthlyRevenueGbp * 100) / 100,
    scanSuccessRate: totalScans > 0 ? Math.round((completed / totalScans) * 100) : 100,
    apiUsageTotal,
    storageUsageBytes,
    topCountries: [...countryCounts.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topFindings: [...findingCounts.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

export async function fetchAdminUsers(params: {
  search?: string;
  plan?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUserRow[]; total: number }> {
  const admin = createAdminClient();
  const emails = await listAuthEmails();

  let query = admin
    .from("profiles")
    .select("id, full_name, plan, role, status, country, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.plan && params.plan !== "all") {
    query = query.eq("plan", params.plan);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data: profiles, count, error } = await query;
  if (error) throw new Error(error.message);

  const userIds = (profiles ?? []).map((p) => p.id);
  const scanCounts = new Map<string, number>();
  const lastActive = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: scans } = await admin
      .from("scan_history")
      .select("user_id, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    for (const scan of scans ?? []) {
      scanCounts.set(scan.user_id, (scanCounts.get(scan.user_id) ?? 0) + 1);
      if (!lastActive.has(scan.user_id)) {
        lastActive.set(scan.user_id, scan.created_at);
      }
    }
  }

  let users: AdminUserRow[] = (profiles ?? []).map((profile) => ({
    id: profile.id,
    email: emails.get(profile.id) ?? "unknown@user",
    fullName: profile.full_name,
    plan: profile.plan,
    role: profile.role ?? "user",
    status: profile.status ?? "active",
    country: profile.country,
    createdAt: profile.created_at,
    lastActive: lastActive.get(profile.id) ?? profile.updated_at,
    totalScans: scanCounts.get(profile.id) ?? 0,
  }));

  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    users = users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.fullName?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q),
    );
  }

  return { users, total: count ?? users.length };
}

export async function fetchAdminUserDetail(userId: string) {
  const admin = createAdminClient();
  const emails = await listAuthEmails();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return null;

  const { count: scanCount } = await admin
    .from("scan_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: recentScans } = await admin
    .from("scan_history")
    .select("id, target, target_type, risk_score, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    profile,
    email: emails.get(userId) ?? null,
    totalScans: scanCount ?? 0,
    recentScans: recentScans ?? [],
  };
}

export async function updateUserStatus(userId: string, status: "active" | "suspended") {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ status }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchAdminScans(params: {
  search?: string;
  status?: string;
  targetType?: string;
  minRisk?: number;
  limit?: number;
  offset?: number;
}): Promise<{ scans: AdminScanRow[]; total: number }> {
  const admin = createAdminClient();
  const emails = await listAuthEmails();

  let query = admin
    .from("scan_history")
    .select(
      "id, user_id, target, target_type, risk_score, status, findings_count, duration_ms, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.targetType && params.targetType !== "all") {
    query = query.eq("target_type", params.targetType);
  }
  if (typeof params.minRisk === "number") {
    query = query.gte("risk_score", params.minRisk);
  }

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  let scans: AdminScanRow[] = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userEmail: emails.get(row.user_id) ?? null,
    target: row.target,
    targetType: row.target_type,
    riskScore: row.risk_score,
    status: row.status,
    findingsCount: row.findings_count ?? 0,
    durationMs: row.duration_ms ?? 0,
    createdAt: row.created_at,
  }));

  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    scans = scans.filter(
      (s) =>
        s.target.toLowerCase().includes(q) ||
        (s.userEmail?.toLowerCase().includes(q) ?? false) ||
        s.id.toLowerCase().includes(q),
    );
  }

  return { scans, total: count ?? scans.length };
}

export async function deleteAdminScan(scanId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("scan_history").delete().eq("id", scanId);
  if (error) throw new Error(error.message);
}

export async function fetchAdminSubscriptions(): Promise<AdminSubscriptionStats> {
  const admin = createAdminClient();
  const emails = await listAuthEmails();

  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, plan, subscription_status, subscription_price_id, cancel_at_period_end, stripe_subscription_id",
    );

  const rows = profiles ?? [];
  const free = rows.filter((p) => p.plan === "free").length;
  const pro = rows.filter((p) => p.plan === "pro").length;
  const business = rows.filter((p) => p.plan === "business").length;

  const activeSubscriptions = rows.filter((p) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(p.subscription_status ?? ""),
  ).length;

  const canceledSubscriptions = rows.filter(
    (p) => p.subscription_status === "canceled" || p.cancel_at_period_end,
  ).length;

  const subscribers = rows
    .filter((p) => p.plan !== "free" && p.stripe_subscription_id)
    .map((p) => ({
      id: p.id,
      email: emails.get(p.id) ?? "unknown",
      plan: p.plan,
      status: p.subscription_status,
      priceId: p.subscription_price_id,
      mrrGbp: estimateMrrFromPriceId(p.subscription_price_id),
      cancelAtPeriodEnd: Boolean(p.cancel_at_period_end),
    }));

  const mrrGbp = subscribers
    .filter((s) => ACTIVE_SUBSCRIPTION_STATUSES.has(s.status ?? ""))
    .reduce((sum, s) => sum + s.mrrGbp, 0);

  return {
    free,
    pro,
    business,
    activeSubscriptions,
    canceledSubscriptions,
    mrrGbp: Math.round(mrrGbp * 100) / 100,
    subscribers,
  };
}

export async function fetchAdminAnalytics(): Promise<AdminAnalyticsData> {
  const admin = createAdminClient();
  const since30 = daysAgoIso(30);

  const [scansRes, profilesRes] = await Promise.all([
    admin
      .from("scan_history")
      .select("created_at, target_type, risk_score, status, report_data")
      .gte("created_at", since30)
      .order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("created_at")
      .gte("created_at", since30)
      .order("created_at", { ascending: true }),
  ]);

  const scans = scansRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  const dailyScansMap = new Map<string, number>();
  const newUsersMap = new Map<string, number>();
  const riskBuckets = { low: 0, medium: 0, high: 0, critical: 0 };
  let website = 0;
  let file = 0;
  const categoryCounts = new Map<string, number>();

  for (const scan of scans) {
    const key = dateKey(scan.created_at);
    dailyScansMap.set(key, (dailyScansMap.get(key) ?? 0) + 1);
    if (scan.target_type === "website") website += 1;
    else file += 1;

    const score = scan.risk_score ?? 0;
    if (score >= 75) riskBuckets.critical += 1;
    else if (score >= 50) riskBuckets.high += 1;
    else if (score >= 25) riskBuckets.medium += 1;
    else riskBuckets.low += 1;

    const report = scan.report_data as { findings?: ScanReportFinding[] } | null;
    for (const finding of report?.findings ?? []) {
      const cat = finding.category ?? "general";
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }

  for (const profile of profiles) {
    const key = dateKey(profile.created_at);
    newUsersMap.set(key, (newUsersMap.get(key) ?? 0) + 1);
  }

  const dailyScans = [...dailyScansMap.entries()].map(([date, count]) => ({ date, count }));
  const newUsers = [...newUsersMap.entries()].map(([date, count]) => ({ date, count }));

  const subStats = await fetchAdminSubscriptions();
  const revenuePerDay = dailyScans.map((d) => ({
    date: d.date,
    amount: d.count > 0 ? Math.round((subStats.mrrGbp / 30) * 100) / 100 : 0,
  }));

  return {
    dailyScans,
    newUsers,
    revenueByDay: revenuePerDay,
    riskDistribution: [
      { bucket: "Low (0–24)", count: riskBuckets.low },
      { bucket: "Medium (25–49)", count: riskBuckets.medium },
      { bucket: "High (50–74)", count: riskBuckets.high },
      { bucket: "Critical (75+)", count: riskBuckets.critical },
    ],
    scanVolume: { website, file },
    threatCategories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

export async function fetchAdminSystemStatus(): Promise<AdminSystemStatus> {
  const admin = createAdminClient();

  let dbOk = false;
  let dbDetail = "Unknown";
  try {
    const { error } = await admin.from("profiles").select("id", { head: true, count: "exact" });
    dbOk = !error;
    dbDetail = error ? error.message : "Connected";
  } catch (err) {
    dbDetail = err instanceof Error ? err.message : "Connection failed";
  }

  const { count: scanCount } = await admin
    .from("scan_history")
    .select("id", { count: "exact", head: true });

  const { data: sampleScans } = await admin
    .from("scan_history")
    .select("report_data")
    .limit(100);

  let usageBytes = 0;
  for (const row of sampleScans ?? []) {
    if (row.report_data) usageBytes += JSON.stringify(row.report_data).length;
  }

  return {
    environment: [
      { name: "Node environment", ok: true, detail: process.env.NODE_ENV ?? "development" },
      { name: "Supabase", ok: isSupabaseConfigured(), detail: isSupabaseConfigured() ? "Configured" : "Missing keys" },
      { name: "Stripe", ok: isStripeConfigured(), detail: isStripeConfigured() ? "Configured" : "Missing keys" },
    ],
    database: { ok: dbOk, detail: dbDetail },
    queue: {
      ok: true,
      detail: "Monitor job queue available — cron via /api/cron/monitors/run",
    },
    storage: {
      ok: true,
      usageBytes,
      detail: `~${Math.round(usageBytes / 1024)} KB sampled from reports (${scanCount ?? 0} scans total)`,
    },
    aiProvider: {
      ok: isOpenAiConfigured(),
      detail: isOpenAiConfigured() ? "OpenAI configured" : "Not configured — deterministic AI fallback",
    },
    apiProviders: [
      { name: "OpenAI", configured: isOpenAiConfigured() },
      { name: "VirusTotal", configured: isDomainReputationProviderConfigured() },
      { name: "Google Safe Browsing", configured: Boolean(process.env.GOOGLE_SAFE_BROWSING_API_KEY) },
      { name: "URLHaus", configured: Boolean(process.env.URLHAUS_API_KEY) },
      { name: "PhishTank", configured: Boolean(process.env.PHISHTANK_API_KEY) },
    ],
  };
}

export async function fetchAdminMonitoringStats(): Promise<AdminMonitoringStats> {
  const admin = createAdminClient();
  const dayAgo = new Date();
  dayAgo.setUTCDate(dayAgo.getUTCDate() - 1);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [monitorsRes, failedJobsRes, pendingJobsRes, pendingNotifsRes, dailyJobsRes, recentFailuresRes] =
    await Promise.all([
      admin.from("security_monitors").select("status"),
      admin
        .from("monitor_job_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", dayAgo.toISOString()),
      admin
        .from("monitor_job_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("monitor_job_queue")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
      admin
        .from("monitor_job_queue")
        .select("id, monitor_id, error_message, created_at, security_monitors(target_url)")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const monitors = monitorsRes.data ?? [];
  const recentFailures = (recentFailuresRes.data ?? []).map((row) => {
    const joined = row.security_monitors as { target_url?: string } | { target_url?: string }[] | null;
    const targetUrl = Array.isArray(joined) ? joined[0]?.target_url : joined?.target_url;
    return {
      id: row.id as string,
      monitorId: row.monitor_id as string,
      targetUrl: targetUrl ?? "Unknown",
      errorMessage: (row.error_message as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });

  return {
    totalMonitoredWebsites: monitors.length,
    activeMonitors: monitors.filter((m) => m.status === "active").length,
    pausedMonitors: monitors.filter((m) => m.status === "paused").length,
    failedJobs24h: failedJobsRes.count ?? 0,
    pendingJobs: pendingJobsRes.count ?? 0,
    pendingNotifications: pendingNotifsRes.count ?? 0,
    dailyJobsToday: dailyJobsRes.count ?? 0,
    recentFailures,
  };
}
