"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardAiInsights } from "@/components/dashboard/DashboardAiInsights";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPlanCard } from "@/components/dashboard/DashboardPlanCard";
import { DashboardQuickScan } from "@/components/dashboard/DashboardQuickScan";
import { DashboardRecentScans } from "@/components/dashboard/DashboardRecentScans";
import { DashboardSecurityStatusCard } from "@/components/dashboard/DashboardSecurityStatusCard";
import { DashboardStatCards } from "@/components/dashboard/DashboardStatCards";
import { MotionSection } from "@/components/dashboard/dashboard-motion";
import {
  deriveAiInsights,
  deriveDashboardStats,
  deriveSecurityStatus,
  mapToDashboardScan,
} from "@/components/dashboard/dashboard-utils";
import type { DashboardScan } from "@/components/dashboard/dashboard-types";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { getEffectivePlan } from "@/lib/auth/plan";
import {
  fetchScanHistoryList,
  fetchScanHistorySummary,
} from "@/lib/scan-history/client";
import { SCAN_HISTORY_UPDATED_EVENT } from "@/lib/scan-history/events";
import type { ScanHistorySummary } from "@/lib/scan-history/types";
import type { AuthUser } from "@/types/auth";

interface DashboardShellProps {
  user: AuthUser;
}

export function DashboardShell({ user }: DashboardShellProps) {
  const plan = getEffectivePlan(user.profile);
  const { summary: usageSummary, loading: usageLoading } = useUsageSummary();
  const [scans, setScans] = useState<DashboardScan[]>([]);
  const [summary, setSummary] = useState<ScanHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    const [summaryResult, listResult] = await Promise.all([
      fetchScanHistorySummary(),
      fetchScanHistoryList({ limit: 5, sort: "newest" }),
    ]);

    setSummary(summaryResult);

    if ("items" in listResult) {
      setScans(listResult.items.map(mapToDashboardScan));
    } else {
      setScans([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadDashboardData();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDashboardData]);

  useEffect(() => {
    function handleScanHistoryUpdated() {
      void loadDashboardData();
    }

    window.addEventListener(SCAN_HISTORY_UPDATED_EVENT, handleScanHistoryUpdated);
    return () => {
      window.removeEventListener(SCAN_HISTORY_UPDATED_EVENT, handleScanHistoryUpdated);
    };
  }, [loadDashboardData]);

  const stats = useMemo(
    () => deriveDashboardStats(summary, plan),
    [summary, plan],
  );

  const securityStatus = useMemo(() => deriveSecurityStatus(scans), [scans]);

  const insights = useMemo(
    () => deriveAiInsights(scans, summary, securityStatus),
    [scans, summary, securityStatus],
  );

  return (
    <div className="space-y-8 lg:space-y-10">
      <MotionSection delay={0}>
        <DashboardHeader user={user} />
      </MotionSection>

      <MotionSection delay={0.03}>
        <DashboardSecurityStatusCard status={securityStatus} loading={loading} />
      </MotionSection>

      <MotionSection delay={0.05}>
        <DashboardQuickScan />
      </MotionSection>

      <MotionSection delay={0.07}>
        <DashboardRecentScans scans={scans} loading={loading} />
      </MotionSection>

      <MotionSection delay={0.09}>
        <DashboardStatCards stats={stats} loading={loading} />
      </MotionSection>

      <MotionSection delay={0.11}>
        <DashboardAiInsights insights={insights} loading={loading} />
      </MotionSection>

      <MotionSection delay={0.13}>
        <DashboardPlanCard
          user={user}
          plan={plan}
          usage={usageSummary}
          loading={usageLoading}
        />
      </MotionSection>
    </div>
  );
}
