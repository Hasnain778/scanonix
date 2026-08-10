export type StagedProgressStage =
  | "preparing"
  | "uploading"
  | "removing"
  | "preview"
  | "finalizing"
  | "complete";

export interface StagedProgressSnapshot {
  percent: number;
  label: string;
  stage: StagedProgressStage;
}

/** Max staged percent while waiting for the real server response. */
export const STAGED_PROGRESS_WAIT_CAP = 92;

/** Milliseconds to reach wait cap under normal pacing. */
export const STAGED_PROGRESS_RAMP_MS = 48_000;

export const STAGED_PROGRESS_TICK_MS = 400;

export function getStagedProgressSnapshot(percent: number): StagedProgressSnapshot {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  if (clamped >= 100) {
    return { percent: 100, label: "Finalizing result", stage: "complete" };
  }
  if (clamped <= 10) {
    return { percent: clamped, label: "Preparing image", stage: "preparing" };
  }
  if (clamped <= 25) {
    return { percent: clamped, label: "Uploading securely", stage: "uploading" };
  }
  if (clamped <= 80) {
    return { percent: clamped, label: "Removing background", stage: "removing" };
  }
  if (clamped <= 95) {
    return { percent: clamped, label: "Preparing preview", stage: "preview" };
  }
  return { percent: clamped, label: "Finalizing result", stage: "finalizing" };
}

/** Maps elapsed time to a staged percent that never exceeds the wait cap. */
export function computeStagedProgressPercent(
  elapsedMs: number,
  cap: number = STAGED_PROGRESS_WAIT_CAP,
): number {
  if (elapsedMs <= 0) return 0;

  const ratio = Math.min(1, elapsedMs / STAGED_PROGRESS_RAMP_MS);
  const eased = 1 - (1 - ratio) ** 1.6;
  return Math.min(cap, Math.max(0, Math.round(eased * cap)));
}

/** Ensures staged progress never moves backwards. */
export function advanceStagedProgress(current: number, next: number): number {
  return Math.max(current, Math.min(STAGED_PROGRESS_WAIT_CAP, next));
}

export function resolveSuccessProgressPercent(): number {
  return 100;
}

export function shouldAllowCompleteProgress(apiSettled: boolean): boolean {
  return apiSettled;
}
