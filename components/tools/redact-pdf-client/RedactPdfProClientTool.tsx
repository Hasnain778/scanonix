"use client";

import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { RedactPdfClientTool } from "./RedactPdfClientTool";

export function RedactPdfProClientTool() {
  return (
    <SecurityToolWorkspace
      toolName="Redact PDF"
      gateDescription="Draw redaction areas on your PDF locally. Upgrade to Pro to apply redactions and download."
    >
      {({ showGate }) => (
        <RedactPdfClientTool proGateActive={showGate} toolId="redact-pdf" />
      )}
    </SecurityToolWorkspace>
  );
}
