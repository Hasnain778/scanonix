import { createHash } from "crypto";
import type { ScanReport } from "@/lib/scan-report/types";
import type { MonitorChangeSet, MonitorSnapshot } from "@/lib/monitors/types";

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function hashFindings(report: ScanReport): string {
  const payload = report.findings
    .filter((f) => f.severity !== "info")
    .map((f) => `${f.id}:${f.severity}:${f.title}`)
    .sort()
    .join("|");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildMonitorSnapshot(report: ScanReport): MonitorSnapshot {
  const intelligence = report.intelligence;
  const reputation = intelligence?.domainReputation;

  return {
    riskScore: report.riskScore,
    findingsHash: hashFindings(report),
    findingIds: report.findings
      .filter((f) => f.severity !== "info")
      .map((f) => f.id)
      .sort(),
    headers: {
      server: intelligence?.serverHeader ?? null,
      poweredBy: intelligence?.poweredByHeader ?? null,
    },
    ssl: {
      valid: intelligence?.ssl.valid ?? false,
      daysRemaining: intelligence?.ssl.daysRemaining ?? null,
      issuer: intelligence?.ssl.issuer ?? null,
    },
    dns: {
      a: reputation?.dns.a ?? [],
      mx: reputation?.dns.mx ?? [],
      ns: reputation?.dns.ns ?? [],
    },
    reputation: {
      score: reputation?.reputationScore ?? null,
      trustLevel: reputation?.trustLevel ?? null,
    },
  };
}

function diffArrays(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((item) => !beforeSet.has(item)),
    removed: before.filter((item) => !afterSet.has(item)),
  };
}

export function detectMonitorChanges(
  previous: MonitorSnapshot | null,
  current: MonitorSnapshot,
  report: ScanReport,
): MonitorChangeSet {
  const findingTitleById = new Map(
    report.findings.map((finding) => [finding.id, finding.title]),
  );

  const changes: MonitorChangeSet = {
    newFindings: [],
    resolvedFindings: [],
    riskScoreDelta: previous ? current.riskScore - previous.riskScore : null,
    headerChanges: [],
    dnsChanges: [],
    certificateChanges: [],
    reputationChanges: [],
  };

  if (!previous) {
    changes.newFindings = current.findingIds.map(
      (id) => findingTitleById.get(id) ?? id,
    );
    return changes;
  }

  const findingDiff = diffArrays(previous.findingIds, current.findingIds);
  changes.newFindings = findingDiff.added.map(
    (id) => findingTitleById.get(id) ?? id,
  );
  changes.resolvedFindings = findingDiff.removed.map(
    (id) => findingTitleById.get(id) ?? id,
  );

  if (previous.headers.server !== current.headers.server) {
    changes.headerChanges.push(
      `Server header changed from "${previous.headers.server ?? "none"}" to "${current.headers.server ?? "none"}"`,
    );
  }
  if (previous.headers.poweredBy !== current.headers.poweredBy) {
    changes.headerChanges.push(
      `X-Powered-By changed from "${previous.headers.poweredBy ?? "none"}" to "${current.headers.poweredBy ?? "none"}"`,
    );
  }

  for (const key of ["a", "mx", "ns"] as const) {
    const diff = diffArrays(previous.dns[key], current.dns[key]);
    if (diff.added.length || diff.removed.length) {
      changes.dnsChanges.push(
        `DNS ${key.toUpperCase()} records changed (+${diff.added.length}/-${diff.removed.length})`,
      );
    }
  }

  if (
    previous.ssl.valid !== current.ssl.valid ||
    previous.ssl.daysRemaining !== current.ssl.daysRemaining ||
    previous.ssl.issuer !== current.ssl.issuer
  ) {
    changes.certificateChanges.push(
      `Certificate status changed (valid: ${previous.ssl.valid} → ${current.ssl.valid}, days remaining: ${previous.ssl.daysRemaining ?? "n/a"} → ${current.ssl.daysRemaining ?? "n/a"})`,
    );
  }

  if (
    previous.reputation.score !== current.reputation.score ||
    previous.reputation.trustLevel !== current.reputation.trustLevel
  ) {
    changes.reputationChanges.push(
      `Domain reputation changed (${previous.reputation.score ?? "n/a"} → ${current.reputation.score ?? "n/a"}, trust: ${previous.reputation.trustLevel ?? "n/a"} → ${current.reputation.trustLevel ?? "n/a"})`,
    );
  }

  return changes;
}

export function hasSignificantChanges(changes: MonitorChangeSet): boolean {
  return (
    changes.newFindings.length > 0 ||
    changes.resolvedFindings.length > 0 ||
    (changes.riskScoreDelta !== null && changes.riskScoreDelta !== 0) ||
    changes.headerChanges.length > 0 ||
    changes.dnsChanges.length > 0 ||
    changes.certificateChanges.length > 0 ||
    changes.reputationChanges.length > 0
  );
}

export function snapshotFromJson(value: unknown): MonitorSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as MonitorSnapshot;
}

export function changesFromJson(value: unknown): MonitorChangeSet | null {
  if (!value || typeof value !== "object") return null;
  return value as MonitorChangeSet;
}

export { stableStringify };
