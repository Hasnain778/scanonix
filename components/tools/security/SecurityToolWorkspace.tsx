"use client";

import { type ReactNode } from "react";
import { Shield } from "lucide-react";
import { ProBadge } from "@/components/ui/ProBadge";
import { ProSecurityGate } from "@/components/tools/security/ProSecurityGate";
import { useProAccess } from "@/hooks/useProAccess";

interface SecurityToolWorkspaceProps {
  toolName: string;
  children: (ctx: {
    isPro: boolean;
    showGate: boolean;
    isAuthenticated: boolean;
  }) => ReactNode;
  gateDescription?: string;
  /** Opt-in. Default still renders the shared promotional Pro gate. */
  gate?: "default" | "none";
}

export function SecurityToolWorkspace({
  toolName,
  children,
  gateDescription,
  gate = "default",
}: SecurityToolWorkspaceProps) {
  const { loading, isAuthenticated, isPro } = useProAccess();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-foreground-muted">
        Loading security workspace…
      </div>
    );
  }

  const showGate = !isPro;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-scanonix-orange" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">{toolName}</span>
        <ProBadge />
      </div>

      {children({ isPro, showGate, isAuthenticated })}

      {showGate && gate === "default" ? (
        <ProSecurityGate
          title={`Unlock ${toolName}`}
          description={
            gateDescription ??
            `Configure your file or URL below, then upgrade to Pro to run ${toolName}.`
          }
          isAuthenticated={isAuthenticated}
        />
      ) : null}
    </div>
  );
}
