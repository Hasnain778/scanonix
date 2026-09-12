import type { FindingSeverity, ScanReport } from "@/lib/scan-report/types";

export function getRiskScoreColor(score: number): {
  stroke: string;
  text: string;
  label: string;
  bg: string;
} {
  if (score <= 25) {
    return {
      stroke: "#34d399",
      text: "text-emerald-400",
      label: "Low risk",
      bg: "from-emerald-500/20 to-emerald-500/5",
    };
  }
  if (score <= 50) {
    return {
      stroke: "#facc15",
      text: "text-yellow-400",
      label: "Moderate risk",
      bg: "from-yellow-500/20 to-yellow-500/5",
    };
  }
  if (score <= 75) {
    return {
      stroke: "#fb923c",
      text: "text-orange-400",
      label: "Elevated risk",
      bg: "from-orange-500/20 to-orange-500/5",
    };
  }
  return {
    stroke: "#f87171",
    text: "text-red-400",
    label: "Critical risk",
    bg: "from-red-500/20 to-red-500/5",
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getSeverityStyles(severity: FindingSeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-800 bg-red-700 text-red-50 dark:border-red-500/45 dark:bg-red-500/15 dark:text-red-200";
    case "high":
      return "border-red-700 bg-red-100 text-red-900 dark:border-red-500/35 dark:bg-red-500/12 dark:text-red-300";
    case "medium":
      return "border-amber-700 bg-amber-100 text-amber-950 dark:border-orange-500/35 dark:bg-orange-500/12 dark:text-orange-200";
    case "low":
      return "border-yellow-700 bg-yellow-100 text-yellow-950 dark:border-yellow-500/35 dark:bg-yellow-500/12 dark:text-yellow-200";
    default:
      return "border-emerald-700 bg-emerald-100 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-200";
  }
}

export function getSeverityAccent(severity: FindingSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-red-700 dark:bg-red-600";
    case "high":
      return "bg-red-600 dark:bg-rose-500";
    case "medium":
      return "bg-amber-600 dark:bg-amber-500";
    case "low":
      return "bg-yellow-600 dark:bg-yellow-500";
    default:
      return "bg-emerald-600 dark:bg-emerald-500";
  }
}

/** Display-order helper only — does not mutate report data. */
export function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 1;
  }
}

export function getDifficultyLabel(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

export function serializeReportJson(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}

export function buildShareUrl(reportId: string): string {
  if (typeof window === "undefined") return `/scan-results/${reportId}`;
  return `${window.location.origin}/scan-results/${reportId}`;
}
