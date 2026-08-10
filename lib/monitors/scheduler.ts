import type { MonitorFrequency } from "@/lib/monitors/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeNextScanAt(frequency: MonitorFrequency, from = new Date()): string {
  const next = new Date(from);

  switch (frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }

  return next.toISOString();
}

export function frequencyLabel(frequency: MonitorFrequency): string {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
  }
}

export function isMonitorDue(nextScanAt: string | null, now = new Date()): boolean {
  if (!nextScanAt) return true;
  return new Date(nextScanAt).getTime() <= now.getTime();
}

export function msUntilNextScan(nextScanAt: string | null, now = new Date()): number {
  if (!nextScanAt) return 0;
  return Math.max(0, new Date(nextScanAt).getTime() - now.getTime());
}

export function frequencyIntervalMs(frequency: MonitorFrequency): number {
  switch (frequency) {
    case "daily":
      return DAY_MS;
    case "weekly":
      return 7 * DAY_MS;
    case "monthly":
      return 30 * DAY_MS;
  }
}

export function normalizeMonitorUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidMonitorUrl(input: string): boolean {
  try {
    const url = new URL(normalizeMonitorUrl(input));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
