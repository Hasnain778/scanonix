"use client";

import { type ReactNode } from "react";
import { ProPremiumGate } from "@/components/plan/ProPremiumGate";
import { useProAccess } from "@/hooks/useProAccess";

interface PremiumAiToolGateProps {
  toolName: string;
  toolSlug?: string;
  description?: string;
  children: ReactNode;
}

export function PremiumAiToolGate({
  toolName,
  toolSlug,
  description,
  children,
}: PremiumAiToolGateProps) {
  const { loading, isAuthenticated, isPro } = useProAccess();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-foreground-muted">
        Loading workspace…
      </div>
    );
  }

  if (!isPro) {
    return (
      <ProPremiumGate
        title={`Unlock ${toolName}`}
        description={
          description ??
          `Sign in and upgrade to Scanonix Pro to use ${toolName}. Free tools stay available without an account.`
        }
        isAuthenticated={isAuthenticated}
        toolSlug={toolSlug}
      />
    );
  }

  return <>{children}</>;
}
