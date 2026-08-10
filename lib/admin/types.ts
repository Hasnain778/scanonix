import { env } from "@/config/env";

/** Monthly recurring revenue estimate (GBP) by Stripe price ID. */
const PRICE_MRR_GBP: Record<string, number> = {
  [env.stripeProMonthlyPriceId]: 9.99,
  [env.stripeProYearlyPriceId]: 99 / 12,
  [env.stripeBusinessMonthlyPriceId]: 29.99,
  [env.stripeBusinessYearlyPriceId]: 299 / 12,
};

export function estimateMrrFromPriceId(priceId: string | null | undefined): number {
  if (!priceId) return 0;
  return PRICE_MRR_GBP[priceId] ?? 0;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalScans: number;
  websiteScans: number;
  fileScans: number;
  averageRiskScore: number;
  premiumSubscribers: number;
  monthlyRevenueGbp: number;
  scanSuccessRate: number;
  apiUsageTotal: number;
  storageUsageBytes: number;
  topCountries: { country: string; count: number }[];
  topFindings: { title: string; count: number }[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  role: string;
  status: string;
  country: string | null;
  createdAt: string;
  lastActive: string | null;
  totalScans: number;
}

export interface AdminScanRow {
  id: string;
  userId: string;
  userEmail: string | null;
  target: string;
  targetType: string;
  riskScore: number;
  status: string;
  findingsCount: number;
  durationMs: number;
  createdAt: string;
}

export interface AdminSubscriptionStats {
  free: number;
  pro: number;
  business: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  mrrGbp: number;
  subscribers: {
    id: string;
    email: string;
    plan: string;
    status: string | null;
    priceId: string | null;
    mrrGbp: number;
    cancelAtPeriodEnd: boolean;
  }[];
}

export interface AdminAnalyticsData {
  dailyScans: { date: string; count: number }[];
  newUsers: { date: string; count: number }[];
  revenueByDay: { date: string; amount: number }[];
  riskDistribution: { bucket: string; count: number }[];
  scanVolume: { website: number; file: number };
  threatCategories: { category: string; count: number }[];
}

export interface AdminSystemStatus {
  environment: { name: string; ok: boolean; detail: string }[];
  database: { ok: boolean; detail: string };
  queue: { ok: boolean; detail: string };
  storage: { ok: boolean; usageBytes: number; detail: string };
  aiProvider: { ok: boolean; detail: string };
  apiProviders: { name: string; configured: boolean }[];
}

export interface AdminMonitoringStats {
  totalMonitoredWebsites: number;
  activeMonitors: number;
  pausedMonitors: number;
  failedJobs24h: number;
  pendingJobs: number;
  pendingNotifications: number;
  dailyJobsToday: number;
  recentFailures: {
    id: string;
    monitorId: string;
    targetUrl: string;
    errorMessage: string | null;
    createdAt: string;
  }[];
}

export interface AdminChartPoint {
  label: string;
  value: number;
}
