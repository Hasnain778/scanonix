"use client";

import { formatPlanError } from "@/lib/plan/tool-gate";
import type { UpscaleJobPublicStatus } from "@/lib/upscale-jobs/types";
import type { ImageToolStats } from "@/lib/tools/image/client";

export const UPSCALE_ACTIVE_JOB_STORAGE_KEY = "scanonix:image-upscaler:active-job";

export const UPSCALE_JOB_POLL_INTERVAL_MS = 2000;

function parseHeaderInt(headers: Headers, key: string): number | undefined {
  const value = headers.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapUpscaleClientError(error: unknown, status?: number, body?: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Upscaling failed — please try again.";

  const normalized = raw.toLowerCase();
  const payload = (body ?? raw).toLowerCase();

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("aborted") ||
    status === 504
  ) {
    return "Processing timed out. Try a smaller image or use 2× instead of 4×.";
  }

  if (payload.includes("timed out") || payload.includes("timeout")) {
    return "Processing timed out. Try a smaller image or use 2× instead of 4×.";
  }

  if (payload.includes("too large") || payload.includes("maximum supported dimensions")) {
    return "Image too large for processing.";
  }

  if (status === 503 || payload.includes("not configured")) {
    return "Upscaling service temporarily unavailable.";
  }

  if (payload.includes("unauthorized")) {
    return "Upscaling service temporarily unavailable.";
  }

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { error?: string; detail?: { error?: string } };
      if (parsed.detail?.error) return mapUpscaleClientError(parsed.detail.error);
      if (parsed.error) return mapUpscaleClientError(parsed.error);
    } catch {
      // fall through
    }
  }

  return raw.length > 180 ? "Upscaling failed — please try again." : raw;
}

export async function createUpscaleJob(
  formData: FormData,
): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  let response: Response;

  try {
    response = await fetch("/api/tools/image/upscale/jobs", {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    return { ok: false, message: mapUpscaleClientError(error) };
  }

  if (!response.ok) {
    let message = "Upscaling failed — please try again.";
    let bodyText = "";
    try {
      bodyText = await response.text();
      const data = JSON.parse(bodyText) as { error?: string; code?: string };
      message = formatPlanError(data, response.status);
      if (data.error) {
        message = mapUpscaleClientError(data.error, response.status, bodyText);
      }
    } catch {
      message = mapUpscaleClientError(response.statusText, response.status, bodyText);
    }
    return { ok: false, message };
  }

  try {
    const data = (await response.json()) as { jobId?: string };
    if (!data.jobId) {
      return { ok: false, message: "Upscaling failed — missing job id." };
    }
    return { ok: true, jobId: data.jobId };
  } catch (error) {
    return { ok: false, message: mapUpscaleClientError(error) };
  }
}

export async function fetchUpscaleJobStatus(
  jobId: string,
): Promise<{ ok: true; status: UpscaleJobPublicStatus } | { ok: false; message: string }> {
  let response: Response;

  try {
    response = await fetch(`/api/tools/image/upscale/jobs/${encodeURIComponent(jobId)}`, {
      method: "GET",
      cache: "no-store",
    });
  } catch (error) {
    return { ok: false, message: mapUpscaleClientError(error) };
  }

  if (!response.ok) {
    let message = "Could not load upscale job status.";
    let bodyText = "";
    try {
      bodyText = await response.text();
      const data = JSON.parse(bodyText) as { error?: string };
      if (data.error) {
        message = mapUpscaleClientError(data.error, response.status, bodyText);
      }
    } catch {
      message = mapUpscaleClientError(response.statusText, response.status, bodyText);
    }
    return { ok: false, message };
  }

  try {
    const status = (await response.json()) as UpscaleJobPublicStatus;
    return { ok: true, status };
  } catch (error) {
    return { ok: false, message: mapUpscaleClientError(error) };
  }
}

export function isTerminalUpscaleJobStatus(status: UpscaleJobPublicStatus): boolean {
  return status.status === "completed" || status.status === "failed" || status.status === "cancelled";
}

export async function waitForUpscaleJobCompletion(
  jobId: string,
  onProgress: (status: UpscaleJobPublicStatus) => void,
  signal?: AbortSignal,
): Promise<{ ok: true; status: UpscaleJobPublicStatus } | { ok: false; message: string }> {
  while (true) {
    if (signal?.aborted) {
      return { ok: false, message: "Upscaling was cancelled." };
    }

    const result = await fetchUpscaleJobStatus(jobId);
    if (!result.ok) {
      return result;
    }

    onProgress(result.status);

    if (isTerminalUpscaleJobStatus(result.status)) {
      if (result.status.status === "failed") {
        return {
          ok: false,
          message: result.status.errorMessage ?? "Upscaling failed — please try again.",
        };
      }
      return result;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(resolve, UPSCALE_JOB_POLL_INTERVAL_MS);
      if (!signal) return;

      const onAbort = () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      };

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

export async function fetchUpscaleJobResult(
  jobId: string,
): Promise<
  | { ok: true; blob: Blob; fileName: string; stats: ImageToolStats }
  | { ok: false; message: string }
> {
  let response: Response;

  try {
    response = await fetch(
      `/api/tools/image/upscale/jobs/${encodeURIComponent(jobId)}/result`,
      { method: "GET", cache: "no-store" },
    );
  } catch (error) {
    return { ok: false, message: mapUpscaleClientError(error) };
  }

  if (!response.ok) {
    let message = "Could not download upscaled image.";
    let bodyText = "";
    try {
      bodyText = await response.text();
      const data = JSON.parse(bodyText) as { error?: string };
      if (data.error) {
        message = mapUpscaleClientError(data.error, response.status, bodyText);
      }
    } catch {
      message = mapUpscaleClientError(response.statusText, response.status, bodyText);
    }
    return { ok: false, message };
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? "upscaled.jpg";

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    return { ok: false, message: mapUpscaleClientError(error) };
  }

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

export async function submitImageUpscaleForm(
  formData: FormData,
  onProgress?: (status: UpscaleJobPublicStatus) => void,
  signal?: AbortSignal,
): Promise<
  | { ok: true; blob: Blob; fileName: string; stats: ImageToolStats }
  | { ok: false; message: string }
> {
  const created = await createUpscaleJob(formData);
  if (!created.ok) {
    return created;
  }

  try {
    sessionStorage.setItem(UPSCALE_ACTIVE_JOB_STORAGE_KEY, created.jobId);
  } catch {
    // sessionStorage may be unavailable in private mode
  }

  try {
    const completed = await waitForUpscaleJobCompletion(
      created.jobId,
      (status) => onProgress?.(status),
      signal,
    );
    if (!completed.ok) {
      return completed;
    }

    const result = await fetchUpscaleJobResult(created.jobId);
    if (result.ok) {
      try {
        sessionStorage.removeItem(UPSCALE_ACTIVE_JOB_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, message: "Upscaling was cancelled." };
    }
    return { ok: false, message: mapUpscaleClientError(error) };
  }
}

export function readStoredUpscaleJobId(): string | null {
  try {
    return sessionStorage.getItem(UPSCALE_ACTIVE_JOB_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredUpscaleJobId(): void {
  try {
    sessionStorage.removeItem(UPSCALE_ACTIVE_JOB_STORAGE_KEY);
  } catch {
    // ignore
  }
}
