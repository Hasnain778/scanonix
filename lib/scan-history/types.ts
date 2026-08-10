import type { ScanReport } from "@/lib/scan-report/types";

export type ScanTargetType = "website" | "file";

export type ScanHistoryStatus = "completed" | "processing" | "failed";

export type ScanRiskLevel = "low" | "medium" | "high" | "critical";

export type ScanRiskFilter =
  | "all"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "clean"
  | "failed";

export type ScanTypeFilter = "all" | "website" | "file";

export type ScanDateFilter = "all" | "today" | "7d" | "30d" | "custom";

export type ScanSortOption = "newest" | "oldest" | "highest_risk" | "lowest_risk";

export interface ScanHistoryRecord {
  id: string;
  target: string;
  targetType: ScanTargetType;
  riskScore: number;
  riskLevel: ScanRiskLevel;
  status: ScanHistoryStatus;
  durationMs: number;
  findingsCount: number;
  createdAt: string;
  errorMessage?: string | null;
}

export interface ScanHistorySummary {
  totalScans: number;
  highRiskScans: number;
  cleanScans: number;
  averageRiskScore: number;
}

export interface ScanHistoryListResponse {
  items: ScanHistoryRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ScanHistoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  risk?: ScanRiskFilter;
  type?: ScanTypeFilter;
  date?: ScanDateFilter;
  dateFrom?: string;
  dateTo?: string;
  sort?: ScanSortOption;
}

export interface ScanHistoryRow {
  id: string;
  user_id: string;
  target: string;
  target_type: ScanTargetType;
  risk_score: number;
  status: ScanHistoryStatus;
  duration_ms: number;
  findings_count: number;
  error_message: string | null;
  scan_token: string | null;
  report_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface SaveScanHistoryInput {
  scanId: string;
  target: string;
  targetType: ScanTargetType;
  status: ScanHistoryStatus;
  riskScore: number;
  durationMs: number;
  findingsCount: number;
  report?: ScanReport | null;
  errorMessage?: string | null;
}

export interface SaveScanHistoryResult {
  record: ScanHistoryRecord;
  report: ScanReport | null;
  duplicate: boolean;
}

export interface ScanHistorySummaryRow {
  total_scans: number;
  high_risk_scans: number;
  clean_scans: number;
  average_risk_score: number;
}
