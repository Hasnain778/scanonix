export type UpscaleStagedProgressStage =
  | "preparing"
  | "uploading"
  | "upscaling"
  | "preparing-result"
  | "finalizing"
  | "complete";

export interface UpscaleStagedProgressSnapshot {
  percent: number;
  label: string;
  stage: UpscaleStagedProgressStage;
}

/** Max staged percent while waiting for the real server response. */
export const UPSCALE_STAGED_PROGRESS_WAIT_CAP = 92;

/** Milliseconds to reach wait cap under normal pacing. */
export const UPSCALE_STAGED_PROGRESS_RAMP_MS = 54_000;

export const UPSCALE_STAGED_PROGRESS_TICK_MS = 400;

export function getUpscaleStagedProgressSnapshot(percent: number): UpscaleStagedProgressSnapshot {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  if (clamped >= 100) {
    return { percent: 100, label: "Finalizing", stage: "complete" };
  }
  if (clamped <= 10) {
    return { percent: clamped, label: "Preparing image", stage: "preparing" };
  }
  if (clamped <= 25) {
    return { percent: clamped, label: "Uploading securely", stage: "uploading" };
  }
  if (clamped <= 85) {
    return { percent: clamped, label: "Upscaling image", stage: "upscaling" };
  }
  if (clamped <= 95) {
    return { percent: clamped, label: "Preparing result", stage: "preparing-result" };
  }
  return { percent: clamped, label: "Finalizing", stage: "finalizing" };
}

export function computeUpscaleStagedProgressPercent(
  elapsedMs: number,
  cap: number = UPSCALE_STAGED_PROGRESS_WAIT_CAP,
): number {
  if (elapsedMs <= 0) return 0;

  const ratio = Math.min(1, elapsedMs / UPSCALE_STAGED_PROGRESS_RAMP_MS);
  const eased = 1 - (1 - ratio) ** 1.6;
  return Math.min(cap, Math.max(0, Math.round(eased * cap)));
}

export function advanceUpscaleStagedProgress(current: number, next: number): number {
  return Math.max(current, Math.min(UPSCALE_STAGED_PROGRESS_WAIT_CAP, next));
}

export function resolveUpscaleSuccessProgressPercent(): number {
  return 100;
}
