"use client";

import { UsageBanner } from "@/components/plan/UsageBanner";
import { useUsageSummary } from "@/hooks/useUsageSummary";

export function ToolUsageHeader() {
  const { summary, loading } = useUsageSummary();

  return (
    <UsageBanner
      summary={summary}
      loading={loading}
      className="mb-6"
    />
  );
}
