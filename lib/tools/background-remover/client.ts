"use client";

import { formatPlanError } from "@/lib/plan/tool-gate";

export interface BackgroundRemovalClientResult {
  transparentBlob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasOptimized: boolean;
}

function parseHeaderInt(headers: Headers, key: string): number | undefined {
  const value = headers.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function submitBackgroundRemovalForm(
  formData: FormData,
): Promise<
  | { ok: true; result: BackgroundRemovalClientResult }
  | { ok: false; message: string; code?: string }
> {
  const response = await fetch("/api/tools/background-remover/remove", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Background removal failed.";
    let code: string | undefined;
    try {
      const data = (await response.json()) as { error?: string; code?: string };
      message = formatPlanError(data, response.status);
      if (data.error) message = data.error;
      code = data.code;
      if (response.status === 503) {
        message = data.error ?? "Background removal service is not configured.";
      }
    } catch {
      message = response.statusText || message;
    }
    return { ok: false, message, code };
  }

  const blob = await response.blob();
  const transparentBlob =
    blob.type === "image/png"
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: "image/png" });
  const width = parseHeaderInt(response.headers, "X-Output-Width") ?? 0;
  const height = parseHeaderInt(response.headers, "X-Output-Height") ?? 0;
  const originalWidth =
    parseHeaderInt(response.headers, "X-Original-Width") ?? width;
  const originalHeight =
    parseHeaderInt(response.headers, "X-Original-Height") ?? height;
  const wasOptimized = response.headers.get("X-Processing-Optimized") === "true";
  const previewUrl = URL.createObjectURL(transparentBlob);

  return {
    ok: true,
    result: {
      transparentBlob,
      previewUrl,
      width,
      height,
      originalWidth,
      originalHeight,
      wasOptimized,
    },
  };
}
