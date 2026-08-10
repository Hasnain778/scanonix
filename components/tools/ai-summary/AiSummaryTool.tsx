"use client";

import { CloudAiTextTool } from "@/components/tools/ai/CloudAiTextTool";

export function AiSummaryTool() {
  return (
    <CloudAiTextTool
      mode="summary"
      actionLabel="Generate summary"
      inputLabel="Document text"
      inputPlaceholder="Paste text from a document, email, or OCR result to summarise…"
      resultTitle="Summary"
      privacyNote="Text is sent securely to OpenAI for processing. Do not paste confidential content unless your organisation allows cloud AI."
    />
  );
}
