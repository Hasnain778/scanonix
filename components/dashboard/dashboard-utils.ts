import type { AuthUser } from "@/types/auth";
import type { ScanHistoryRecord, ScanHistorySummary } from "@/lib/scan-history/types";
import type {
  DashboardInsight,
  DashboardScan,
  DashboardStats,
  ScanRisk,
  SecurityStatus,
} from "@/components/dashboard/dashboard-types";

export function getFirstName(user: AuthUser): string {
  const fullName = user.profile?.full_name?.trim();
  if (fullName) {
    return fullName.split(/\s+/)[0] ?? fullName;
  }
  return user.email.split("@")[0] || "there";
}

export function getGreetingName(user: AuthUser): string {
  return getFirstName(user);
}

export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDashboardDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatShortDate(value);
}

export function mapToDashboardScan(record: ScanHistoryRecord): DashboardScan {
  return {
    id: record.id,
    target: record.target,
    scanType: record.targetType,
    risk: record.riskLevel,
    status: record.status,
    date: record.createdAt,
  };
}

export function getFriendlyRiskLabel(risk: ScanRisk): string {
  switch (risk) {
    case "low":
      return "Safe";
    case "medium":
      return "Warning";
    case "high":
      return "Dangerous";
    case "critical":
      return "Dangerous";
  }
}

export function getHeroHeadline(status: SecurityStatus): string {
  switch (status) {
    case "protected":
      return "You're Protected";
    case "needs_attention":
      return "Needs Review";
    case "high_risk":
      return "High Risk Detected";
    case "no_scans":
      return "Ready to Scan";
  }
}

export function getHeroDescription(status: SecurityStatus): string {
  switch (status) {
    case "protected":
      return "No critical threats detected.";
    case "needs_attention":
      return "Some scans contain warnings worth reviewing.";
    case "high_risk":
      return "A recent scan found serious threats.";
    case "no_scans":
      return "Run your first scan to see your protection status.";
  }
}

export function deriveAiInsights(
  scans: DashboardScan[],
  summary: ScanHistorySummary | null,
  status: SecurityStatus,
): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  if (status === "no_scans" || !summary || summary.totalScans === 0) {
    return [
      {
        id: "start",
        message: "Run your first scan to unlock personalised security insights.",
        tone: "neutral",
      },
    ];
  }

  if (summary.highRiskScans === 0) {
    insights.push({
      id: "healthy",
      message: "Everything looks healthy.",
      tone: "positive",
    });
    insights.push({
      id: "no-malware",
      message: "No malware detected in recent scans.",
      tone: "positive",
    });
  } else {
    insights.push({
      id: "threats",
      message: `${summary.highRiskScans} scan${summary.highRiskScans === 1 ? "" : "s"} flagged high-risk findings.`,
      tone: "warning",
    });
  }

  const warningScans = scans.filter((scan) => scan.risk === "medium").length;
  if (warningScans > 0) {
    insights.push({
      id: "recommendations",
      message: `${warningScans} recommendation${warningScans === 1 ? "" : "s"} available.`,
      tone: "neutral",
    });
  } else if (status === "protected" && insights.length < 3) {
    insights.push({
      id: "ssl",
      message: "Your latest website scans passed security checks.",
      tone: "positive",
    });
  }

  if (summary.cleanScans > 0 && insights.length < 3) {
    insights.push({
      id: "clean",
      message: `${summary.cleanScans} clean scan${summary.cleanScans === 1 ? "" : "s"} this period.`,
      tone: "positive",
    });
  }

  return insights.slice(0, 4);
}

export function getPlanBenefits(plan: string): string[] {
  switch (plan) {
    case "business":
      return ["2,500 ops/month", "Priority monitoring", "Team workspace", "Dedicated support"];
    case "pro":
      return ["Advanced scans", "Site monitoring", "AI assistant", "Priority support"];
    default:
      return ["Basic security scans", "Scan history", "Email alerts", "Community support"];
  }
}

export function getScanTypeLabel(scanType: DashboardScan["scanType"]): string {
  return scanType === "website" ? "Website" : "File";
}

export function deriveDashboardStats(
  summary: ScanHistorySummary | null,
  plan: string,
): DashboardStats {
  return {
    totalScans: summary?.totalScans ?? 0,
    protectedAssets: summary?.cleanScans ?? 0,
    threatsFound: summary?.highRiskScans ?? 0,
    currentPlan: plan,
  };
}

export function deriveSecurityStatus(scans: DashboardScan[]): SecurityStatus {
  if (scans.length === 0) {
    return "no_scans";
  }

  const completed = scans.filter((scan) => scan.status === "completed");

  if (completed.some((scan) => scan.risk === "critical" || scan.risk === "high")) {
    return "high_risk";
  }

  if (completed.some((scan) => scan.risk === "medium")) {
    return "needs_attention";
  }

  return "protected";
}

export function getPlanBadgeClass(plan: string): string {
  switch (plan) {
    case "business":
      return "border-violet-400/40 bg-violet-500/15 text-violet-200";
    case "pro":
      return "border-scanonix-orange/40 bg-scanonix-orange/15 text-scanonix-orange-light";
    default:
      return "border-white/15 bg-white/8 text-scanonix-muted";
  }
}

export function getBillingStatusLabel(
  plan: string,
  subscriptionStatus: string | null,
): string {
  if (plan === "free") return "Free tier";
  if (subscriptionStatus === "active") return "Active";
  if (subscriptionStatus === "trialing") return "Trialing";
  if (subscriptionStatus === "past_due") return "Past due";
  if (subscriptionStatus === "canceled") return "Canceled";
  return subscriptionStatus ?? "Unknown";
}
