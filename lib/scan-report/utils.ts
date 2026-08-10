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
      return "border-red-950/60 bg-red-950/40 text-red-200";
    case "high":
      return "border-red-500/35 bg-red-500/12 text-red-300";
    case "medium":
      return "border-orange-500/35 bg-orange-500/12 text-orange-200";
    case "low":
      return "border-yellow-500/35 bg-yellow-500/12 text-yellow-200";
    default:
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-200";
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
