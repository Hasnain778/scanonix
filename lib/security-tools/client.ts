"use client";

import { formatPlanError } from "@/lib/plan/tool-gate";

export async function submitSecurityToolForm(
  endpoint: string,
  formData: FormData,
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; message: string }> {
  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Operation failed.";
    try {
      const data = (await response.json()) as { error?: string; code?: string };
      message = formatPlanError(data, response.status);
    } catch {
      message = response.statusText || message;
    }
    return { ok: false, message };
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? "output.bin";
  const blob = await response.blob();

  return { ok: true, blob, fileName };
}
