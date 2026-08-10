"use client";

import { type ReactNode } from "react";
import { ProSecurityGate } from "@/components/tools/security/ProSecurityGate";
import { useProAccess } from "@/hooks/useProAccess";

interface ProToolGateProps {
  toolName: string;
  description?: string;
  children: ReactNode;
}

export function ProToolGate({ toolName, description, children }: ProToolGateProps) {
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
      <ProSecurityGate
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
