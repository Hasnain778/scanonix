import type { UpscaleJobStage, UpscaleJobStatus } from "./types";

export interface UpscaleJobProgressSnapshot {
  percent: number;
  label: string;
  stage: UpscaleJobStage;
}

const STAGE_LABELS: Record<UpscaleJobStage, string> = {
  preparing: "Preparing image",
  queued: "Queued",
  upscaling: "Upscaling",
  preparing_result: "Preparing result",
  finalizing: "Preparing result",
  completed: "Completed",
};

const STAGE_FLOOR_PERCENT: Record<UpscaleJobStage, number> = {
  preparing: 5,
  queued: 15,
  upscaling: 25,
  preparing_result: 85,
  finalizing: 92,
  completed: 100,
};

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getUpscaleJobProgressLabel(stage: UpscaleJobStage): string {
  return STAGE_LABELS[stage] ?? "Upscaling";
}

export function getUpscaleJobProgressSnapshot(
  status: UpscaleJobStatus,
  stage: UpscaleJobStage,
  progress: number,
): UpscaleJobProgressSnapshot {
  if (status === "failed") {
    return {
      percent: clampPercent(progress),
      label: "Failed",
      stage,
    };
  }

  if (status === "cancelled") {
    return {
      percent: clampPercent(progress),
      label: "Cancelled",
      stage,
    };
  }

  if (status === "completed" || stage === "completed") {
    return {
      percent: 100,
      label: "Completed",
      stage: "completed",
    };
  }

  const floor = STAGE_FLOOR_PERCENT[stage] ?? 0;
  const percent = clampPercent(Math.max(progress, floor));

  return {
    percent,
    label: getUpscaleJobProgressLabel(stage),
    stage,
  };
}
