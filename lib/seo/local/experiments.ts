/**
 * Local gitignored SEO experiment ledger (SEO-AUTO-2).
 * Never auto-approves. Never infers commits/deployments.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SEO_EXPERIMENTS_DIR,
  DEFAULT_SEO_REPORT_DIR,
} from "@/lib/seo/local/constants";
import type { TrendLabel } from "@/lib/seo/local/trends";
import { detectImpressionTrend } from "@/lib/seo/local/trends";

export type ExperimentStatus =
  | "proposed"
  | "approved"
  | "shipped"
  | "measuring"
  | "concluded";

export interface ExperimentMetricsSnapshot {
  recordedAt: string;
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  perQuery?: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export interface SeoExperiment {
  id: string;
  page: string;
  slug?: string;
  status: ExperimentStatus;
  changeDate?: string;
  commitSha?: string;
  filesChanged?: string[];
  queriesTargeted?: string[];
  baselinePeriod?: string;
  baseline?: ExperimentMetricsSnapshot;
  checkpoints?: {
    day7?: ExperimentMetricsSnapshot;
    day14?: ExperimentMetricsSnapshot;
    day28?: ExperimentMetricsSnapshot;
  };
  postChangeSnapshots?: ExperimentMetricsSnapshot[];
  humanApprover?: string;
  approvalNote?: string;
  holds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ExperimentSignal =
  | "NOT_ENOUGH_ELAPSED_TIME"
  | "INSUFFICIENT_EVIDENCE"
  | "IMPROVEMENT_SIGNAL"
  | "DECLINE_SIGNAL"
  | "MIXED_UNCLEAR";

export interface ExperimentStatusReport {
  experimentId: string;
  status: ExperimentStatus;
  signal: ExperimentSignal;
  trend: TrendLabel;
  note: string;
  /** Correlation / post-change observation only — not causality. */
  causalityClaim: false;
}

function experimentsDir(cwd = process.cwd()): string {
  return join(cwd, DEFAULT_SEO_REPORT_DIR, DEFAULT_SEO_EXPERIMENTS_DIR);
}

export function ensureExperimentsDir(cwd = process.cwd()): string {
  const dir = experimentsDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function experimentPath(id: string, cwd = process.cwd()): string {
  const safe = id.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(experimentsDir(cwd), `${safe}.json`);
}

export function readExperiment(id: string, cwd = process.cwd()): SeoExperiment | null {
  const path = experimentPath(id, cwd);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as SeoExperiment;
}

export function listExperiments(cwd = process.cwd()): SeoExperiment[] {
  const dir = experimentsDir(cwd);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const raw = readFileSync(join(dir, name), "utf8");
      return JSON.parse(raw) as SeoExperiment;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Create a draft experiment in `proposed` status.
 * Does NOT mark approved/shipped. Human must update explicitly later.
 */
export function createProposedExperiment(
  input: {
    id: string;
    page: string;
    slug?: string;
    queriesTargeted?: string[];
    baselinePeriod?: string;
    baseline?: ExperimentMetricsSnapshot;
    holds?: string[];
  },
  cwd = process.cwd(),
): SeoExperiment {
  ensureExperimentsDir(cwd);
  const now = new Date().toISOString();
  const experiment: SeoExperiment = {
    id: input.id,
    page: input.page,
    slug: input.slug,
    status: "proposed",
    queriesTargeted: input.queriesTargeted,
    baselinePeriod: input.baselinePeriod,
    baseline: input.baseline,
    holds: input.holds,
    checkpoints: {},
    postChangeSnapshots: [],
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(experimentPath(input.id, cwd), JSON.stringify(experiment, null, 2), "utf8");
  return experiment;
}

/**
 * Explicit human approval only — never call from automated propose path.
 */
export function markExperimentApproved(
  id: string,
  humanApprover: string,
  approvalNote: string,
  cwd = process.cwd(),
): SeoExperiment {
  const existing = readExperiment(id, cwd);
  if (!existing) {
    throw new Error(`Experiment not found: ${id}`);
  }
  if (!humanApprover.trim()) {
    throw new Error("humanApprover is required for explicit approval.");
  }
  const updated: SeoExperiment = {
    ...existing,
    status: "approved",
    humanApprover: humanApprover.trim(),
    approvalNote: approvalNote.trim(),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(experimentPath(id, cwd), JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

export function evaluateExperimentAgainstMetrics(
  experiment: SeoExperiment,
  current: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  },
  options: { daysSinceChange?: number } = {},
): ExperimentStatusReport {
  const baseline = experiment.baseline;
  if (!baseline) {
    return {
      experimentId: experiment.id,
      status: experiment.status,
      signal: "INSUFFICIENT_EVIDENCE",
      trend: "UNCLEAR",
      note: "No baseline metrics recorded on this experiment.",
      causalityClaim: false,
    };
  }

  const days = options.daysSinceChange;
  if (days !== undefined && days < 7) {
    return {
      experimentId: experiment.id,
      status: experiment.status,
      signal: "NOT_ENOUGH_ELAPSED_TIME",
      trend: "UNCLEAR",
      note: `Only ${days} day(s) since changeDate — wait for at least a 7-day window before interpreting results.`,
      causalityClaim: false,
    };
  }

  if (baseline.impressions < 20 && current.impressions < 20) {
    return {
      experimentId: experiment.id,
      status: experiment.status,
      signal: "INSUFFICIENT_EVIDENCE",
      trend: "UNCLEAR",
      note: "Baseline and current impressions are both too low for a reliable post-change signal.",
      causalityClaim: false,
    };
  }

  const trend = detectImpressionTrend(current.impressions, baseline.impressions);
  const ctrDelta = current.ctr - baseline.ctr;
  const posImproved = current.position > 0 && current.position < baseline.position - 2;
  const posWorsened = current.position > 0 && current.position > baseline.position + 2;

  let signal: ExperimentSignal = "MIXED_UNCLEAR";
  let note = "Post-change metrics are mixed or within noise — correlation only, not proven causality.";

  if (trend.label === "RISING" && (ctrDelta >= 0 || posImproved)) {
    signal = "IMPROVEMENT_SIGNAL";
    note =
      "Post-change observation: impressions rising with stable/better CTR or position — correlation only, not proven causality.";
  } else if (trend.label === "FALLING" || (posWorsened && ctrDelta < 0)) {
    signal = "DECLINE_SIGNAL";
    note =
      "Post-change observation: impressions falling and/or weaker engagement metrics — correlation only; investigate confounds.";
  } else if (trend.label === "UNCLEAR") {
    signal = "INSUFFICIENT_EVIDENCE";
    note = trend.note;
  }

  return {
    experimentId: experiment.id,
    status: experiment.status,
    signal,
    trend: trend.label,
    note,
    causalityClaim: false,
  };
}
