"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import { PageHeader } from "@/components/ui/PageHeader";

export function ScanHistoryHeader() {
  return (
    <PageHeader
      eyebrow="Security workspace"
      title="Scan history"
      description="Review and manage your previous security scans."
      action={
        <ActionButton href="/tools/security-scan" size="lg">
          New scan
        </ActionButton>
      }
    />
  );
}
