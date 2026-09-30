"use client";

import { UsageBanner } from "@/components/plan/UsageBanner";
import { useUsageSummary } from "@/hooks/useUsageSummary";

export function ToolUsageHeader({
  tone = "default",
}: {
  /** Opt-in. Default keeps the current banner spacing and elevation. */
  tone?: "default" | "quiet";
}) {
  const { summary, loading } = useUsageSummary();

  return (
    <UsageBanner
      summary={summary}
      loading={loading}
      tone={tone}
      className={tone === "quiet" ? "mb-3" : "mb-6"}
    />
  );
}
