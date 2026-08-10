export type ScanRisk = "low" | "medium" | "high" | "critical";

export type ScanStatus = "completed" | "processing" | "failed";

export type ScanType = "website" | "file";

export type SecurityStatus = "protected" | "needs_attention" | "high_risk" | "no_scans";

export interface DashboardScan {
  id: string;
  target: string;
  scanType: ScanType;
  risk: ScanRisk;
  status: ScanStatus;
  date: string;
}

export interface DashboardStats {
  totalScans: number;
  protectedAssets: number;
  threatsFound: number;
  currentPlan: string;
}

export interface DashboardInsight {
  id: string;
  message: string;
  tone: "positive" | "neutral" | "warning" | "danger";
}

export interface BillingStatusResponse {
  plan: string;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasActiveSubscription: boolean;
}
