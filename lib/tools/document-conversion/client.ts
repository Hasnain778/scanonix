"use client";

import { formatPlanError } from "@/lib/plan/tool-gate";

export async function submitPdfToWordForm(
  formData: FormData,
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; message: string }> {
  const response = await fetch("/api/tools/pdf-to-word", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Conversion failed.";
    try {
      const data = (await response.json()) as { error?: string; code?: string };
      message = formatPlanError(data, response.status);
      if (data.error) message = data.error;
    } catch {
      message = response.statusText || message;
    }
    return { ok: false, message };
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? "document.docx";
  const blob = await response.blob();

  return { ok: true, blob, fileName };
}

export async function submitWordToPdfForm(
  formData: FormData,
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; message: string }> {
  const response = await fetch("/api/tools/word-to-pdf", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Conversion failed.";
    try {
      const data = (await response.json()) as { error?: string; code?: string };
      message = formatPlanError(data, response.status);
      if (data.error) message = data.error;
      if (response.status === 503) {
        message = data.error ?? "Document conversion service is not configured.";
      }
    } catch {
      message = response.statusText || message;
    }
    return { ok: false, message };
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? "document.pdf";
  const blob = await response.blob();

  return { ok: true, blob, fileName };
}
