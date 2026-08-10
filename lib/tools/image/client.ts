"use client";

import { formatPlanError } from "@/lib/plan/tool-gate";

export interface ImageToolStats {
  originalSize: number;
  outputSize: number;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
}

function parseHeaderInt(headers: Headers, key: string): number | undefined {
  const value = headers.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function submitImageToolForm(
  endpoint: string,
  formData: FormData,
): Promise<
  | { ok: true; blob: Blob; fileName: string; stats: ImageToolStats }
  | { ok: false; message: string }
> {
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

  const stats: ImageToolStats = {
    originalSize: parseHeaderInt(response.headers, "X-Original-Size") ?? 0,
    outputSize: parseHeaderInt(response.headers, "X-Output-Size") ?? blob.size,
    width: parseHeaderInt(response.headers, "X-Output-Width"),
    height: parseHeaderInt(response.headers, "X-Output-Height"),
    originalWidth: parseHeaderInt(response.headers, "X-Original-Width"),
    originalHeight: parseHeaderInt(response.headers, "X-Original-Height"),
  };

  return { ok: true, blob, fileName, stats };
}

export async function submitWordToPdfForm(
  formData: FormData,
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; message: string }> {
  const { submitWordToPdfForm: submit } = await import("@/lib/tools/document-conversion/client");
  return submit(formData);
}
