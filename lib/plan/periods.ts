import type { UsagePeriod } from "@/lib/plan/config";

export interface UsagePeriodWindow {
  periodStart: Date;
  periodEnd: Date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function getUsagePeriodWindow(
  period: UsagePeriod,
  now: Date = new Date(),
): UsagePeriodWindow {
  if (period === "day") {
    const periodStart = startOfUtcDay(now);
    return {
      periodStart,
      periodEnd: addUtcDays(periodStart, 1),
    };
  }

  const periodStart = startOfUtcMonth(now);
  return {
    periodStart,
    periodEnd: addUtcMonths(periodStart, 1),
  };
}
