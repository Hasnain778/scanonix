/**
 * Server-only RunPod Serverless trigger for async upscale jobs.
 * Reads env at call time — never expose RUNPOD_API_KEY to the client.
 */

const DEFAULT_RUNPOD_API_BASE = "https://api.runpod.ai/v2";

export function readRunPodApiKey(): string {
  const raw = process.env.RUNPOD_API_KEY?.trim() || "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

export function readRunPodUpscaleEndpointId(): string {
  return (
    process.env.RUNPOD_UPSCALE_ENDPOINT_ID?.trim() ||
    process.env.RUNPOD_ENDPOINT_ID?.trim() ||
    ""
  );
}

export function readRunPodApiBaseUrl(): string {
  const raw = process.env.RUNPOD_API_BASE_URL?.trim();
  return (raw || DEFAULT_RUNPOD_API_BASE).replace(/\/$/, "");
}

export function isRunPodUpscaleTriggerConfigured(): boolean {
  return Boolean(readRunPodApiKey() && readRunPodUpscaleEndpointId());
}

export function buildRunPodPollOnceRunUrl(endpointId?: string): string {
  const id = endpointId ?? readRunPodUpscaleEndpointId();
  return `${readRunPodApiBaseUrl()}/${id}/run`;
}

export type RunPodTriggerResult =
  | { ok: true; runpodJobId: string }
  | { ok: false; message: string; status?: number };

export async function triggerRunPodPollOnce(
  fetchImpl: typeof fetch = fetch,
): Promise<RunPodTriggerResult> {
  const apiKey = readRunPodApiKey();
  const endpointId = readRunPodUpscaleEndpointId();

  if (!apiKey || !endpointId) {
    return { ok: false, message: "RunPod upscale worker is not configured." };
  }

  const url = buildRunPodPollOnceRunUrl(endpointId);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: { mode: "poll_once" } }),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `RunPod trigger failed with status ${response.status}.`,
        status: response.status,
      };
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      return { ok: false, message: "RunPod trigger returned an unexpected response." };
    }

    return { ok: true, runpodJobId: data.id };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "RunPod trigger failed.",
    };
  }
}
