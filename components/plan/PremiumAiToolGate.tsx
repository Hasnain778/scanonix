"use client";

import { type ReactNode } from "react";
import { ProPremiumGate } from "@/components/plan/ProPremiumGate";
import { useProAccess } from "@/hooks/useProAccess";

interface PremiumAiToolGateProps {
  toolName: string;
  description?: string;
  children: ReactNode;
}

export function PremiumAiToolGate({
  toolName,
  description,
  children,
}: PremiumAiToolGateProps) {
  const { loading, isAuthenticated, isPro } = useProAccess();

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#0e0e0e] p-8 text-center text-scanonix-muted">
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
      />
    );
  }

  return <>{children}</>;
}
