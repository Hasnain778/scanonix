"use client";

import { useUsageSummary } from "@/hooks/useUsageSummary";
import { getEffectivePlan } from "@/lib/auth/plan";
import { DashboardCategoryShortcuts } from "@/components/dashboard/DashboardCategoryShortcuts";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPlanCard } from "@/components/dashboard/DashboardPlanCard";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { MotionSection } from "@/components/dashboard/dashboard-motion";
import type { AuthUser } from "@/types/auth";

interface DashboardShellProps {
  user: AuthUser;
}

export function DashboardShell({ user }: DashboardShellProps) {
  const plan = getEffectivePlan(user.profile);
  const { summary: usageSummary, loading: usageLoading } = useUsageSummary();

  return (
    <div className="page-stack">
      <MotionSection delay={0}>
        <DashboardHeader user={user} plan={plan} />
      </MotionSection>

      <MotionSection delay={0.04}>
        <DashboardQuickActions />
      </MotionSection>

      <MotionSection delay={0.08}>
        <DashboardCategoryShortcuts />
      </MotionSection>

      <MotionSection delay={0.12}>
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
