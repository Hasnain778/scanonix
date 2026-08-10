export type MonitorFrequency = "daily" | "weekly" | "monthly";
export type MonitorStatus = "active" | "paused";
export type MonitorRunStatus = "completed" | "failed" | "skipped";
export type MonitorEventSeverity = "info" | "warning" | "critical";
export type NotificationChannel = "email" | "in_app" | "webhook";
export type NotificationQueueStatus = "pending" | "sent" | "failed";
export type MonitorJobStatus = "pending" | "processing" | "completed" | "failed";

export type MonitorEventType =
  | "scan_completed"
  | "scan_failed"
  | "new_vulnerability"
  | "resolved_vulnerability"
  | "risk_increased"
  | "risk_decreased"
  | "header_changed"
  | "dns_changed"
  | "certificate_changed"
  | "reputation_changed"
  | "monitor_created"
  | "monitor_paused"
  | "monitor_resumed";

export interface MonitorSnapshot {
  riskScore: number;
  findingsHash: string;
  findingIds: string[];
  headers: {
    server: string | null;
    poweredBy: string | null;
  };
  ssl: {
    valid: boolean;
    daysRemaining: number | null;
    issuer: string | null;
  };
  dns: {
    a: string[];
    mx: string[];
    ns: string[];
  };
  reputation: {
    score: number | null;
    trustLevel: string | null;
  };
}

export interface MonitorChangeSet {
  newFindings: string[];
  resolvedFindings: string[];
  riskScoreDelta: number | null;
  headerChanges: string[];
  dnsChanges: string[];
  certificateChanges: string[];
  reputationChanges: string[];
}

export interface SecurityMonitorRecord {
  id: string;
  userId: string;
  targetUrl: string;
  label: string | null;
  frequency: MonitorFrequency;
  status: MonitorStatus;
  lastScanAt: string | null;
  nextScanAt: string | null;
  lastScanId: string | null;
  lastRiskScore: number | null;
  lastFindingsHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorRunRecord {
  id: string;
  monitorId: string;
  userId: string;
  scanHistoryId: string | null;
  status: MonitorRunStatus;
  riskScore: number | null;
  previousRiskScore: number | null;
  findingsHash: string | null;
  changes: MonitorChangeSet | null;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
}

export interface MonitorEventRecord {
  id: string;
  monitorId: string;
  monitorRunId: string | null;
  userId: string;
  eventType: MonitorEventType;
  severity: MonitorEventSeverity;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface UserNotificationRecord {
  id: string;
  userId: string;
  monitorId: string | null;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreateMonitorInput {
  targetUrl: string;
  label?: string;
  frequency: MonitorFrequency;
}

export interface MonitorSummary {
  totalMonitors: number;
  activeMonitors: number;
  pausedMonitors: number;
  alertsThisWeek: number;
}

export const MONITOR_LIMITS: Record<import("@/types/auth").UserPlan, number> = {
  free: 1,
  pro: 10,
  business: 50,
};
