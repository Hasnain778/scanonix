/**
 * Experiment checkpoint due-state for monitoring (SEO-AUTO-3).
 * Does not claim causality.
 */

import type { SeoExperiment } from "@/lib/seo/local/experiments";

export type CheckpointWindow = "day7" | "day14" | "day28";

export type CheckpointDueState =
  | "NOT_DUE"
  | "DUE"
  | "AVAILABLE"
  | "INSUFFICIENT_DATA";

export interface CheckpointStatus {
  experimentId: string;
  window: CheckpointWindow;
  state: CheckpointDueState;
  daysSinceChange: number | null;
  note: string;
  causalityClaim: false;
}

const WINDOW_DAYS: Record<CheckpointWindow, number> = {
  day7: 7,
  day14: 14,
  day28: 28,
};

export function daysSinceChangeDate(
  changeDate: string | undefined,
  now = new Date(),
): number | null {
  if (!changeDate) return null;
  const t = Date.parse(changeDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

export function evaluateExperimentCheckpoint(
  experiment: SeoExperiment,
  window: CheckpointWindow,
  now = new Date(),
): CheckpointStatus {
  const required = WINDOW_DAYS[window];
  const days = daysSinceChangeDate(experiment.changeDate, now);
  const recorded = experiment.checkpoints?.[window];

  if (recorded) {
    return {
      experimentId: experiment.id,
      window,
      state: "AVAILABLE",
      daysSinceChange: days,
      note: `${window} checkpoint metrics are recorded — interpret as post-change signal only, not proven causality.`,
      causalityClaim: false,
    };
  }

  if (experiment.status !== "measuring" && experiment.status !== "shipped") {
    return {
      experimentId: experiment.id,
      window,
      state: "INSUFFICIENT_DATA",
      daysSinceChange: days,
      note: `Experiment status is "${experiment.status}" — checkpoint evaluation applies mainly while measuring/shipped.`,
      causalityClaim: false,
    };
  }

  if (days === null) {
    return {
      experimentId: experiment.id,
      window,
      state: "INSUFFICIENT_DATA",
      daysSinceChange: null,
      note: "Missing changeDate — cannot determine checkpoint due state.",
      causalityClaim: false,
    };
  }

  if (days < required) {
    return {
      experimentId: experiment.id,
      window,
      state: "NOT_DUE",
      daysSinceChange: days,
      note: `${window} not due yet (${days}/${required} days elapsed).`,
      causalityClaim: false,
    };
  }

  return {
    experimentId: experiment.id,
    window,
    state: "DUE",
    daysSinceChange: days,
    note: `${window} checkpoint is due — collect a fresh GSC snapshot and record metrics. Do not infer causality automatically.`,
    causalityClaim: false,
  };
}

export function evaluateAllCheckpoints(
  experiment: SeoExperiment,
  now = new Date(),
): CheckpointStatus[] {
  return (["day7", "day14", "day28"] as CheckpointWindow[]).map((w) =>
    evaluateExperimentCheckpoint(experiment, w, now),
  );
}
