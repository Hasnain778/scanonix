import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/config/env";
import { enrichReportWithAiAnalysis } from "@/lib/ai/scan-analysis";
import {
  limitReachedResponse,
  requireProUser,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { saveScanHistoryRecord, getOwnedScanById } from "@/lib/scan-history/server";
import type { ScanTargetType } from "@/lib/scan-history/types";
import { isUuid, runWebsiteScan } from "@/lib/scan/runner";
import { ScanRunnerError } from "@/lib/scan/types";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

interface RunScanJsonBody {
  scanId?: string;
  targetType?: ScanTargetType;
  target?: string;
}

interface ParsedScanRequest {
  scanId: string;
  targetType: "website";
  target?: string;
}

async function parseScanRequest(request: Request): Promise<ParsedScanRequest | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "File scanning is no longer available. Use website scanning instead." },
      { status: 410 },
    );
  }

  let body: RunScanJsonBody;
  try {
    body = (await request.json()) as RunScanJsonBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const scanId = body.scanId?.trim();
  const targetType = body.targetType;

  if (!scanId || !isUuid(scanId)) {
    return NextResponse.json({ error: "A valid scanId is required." }, { status: 400 });
  }

  if (targetType === "file") {
    return NextResponse.json(
      { error: "File scanning is no longer available." },
      { status: 410 },
    );
  }

  if (targetType !== "website") {
    return NextResponse.json({ error: "targetType must be website." }, { status: 400 });
  }

  return {
    scanId,
    targetType: "website",
    target: body.target?.trim(),
  };
}

export async function POST(request: Request) {
  const route = "/api/scans/run";
  const rateLimited = enforceRateLimit(request, {
    route,
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const access = await requireProUser(route);
  if (access instanceof NextResponse) {
    return access;
  }

  const parsed = await parseScanRequest(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }

  const existing = await getOwnedScanById(parsed.scanId, true);
  if (!("error" in existing)) {
    return NextResponse.json({
      record: existing.record,
      report: existing.report,
      duplicate: true,
    });
  }

  try {
    const usage = await consumeUsage(access.user.id, access.plan);
    if (!usage.allowed) {
      return limitReachedResponse(
        route,
        "Tool operation limit reached for your current plan.",
        {
          usageCount: usage.usageCount,
          limit: usage.limit,
          remaining: usage.remaining,
          resetAt: usage.resetAt,
        },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not authorize scan operation.",
      },
      { status: 500 },
    );
  }

  const started = Date.now();

  try {
    let report = await runWebsiteScan({
      scanId: parsed.scanId,
      target: parsed.target?.trim() ?? "",
    });

    report.durationMs = Date.now() - started;

    report = await enrichReportWithAiAnalysis(report, {
      preferCloudAi: access.limits.allowPremiumAi && isOpenAiConfigured(),
    });

    const saved = await saveScanHistoryRecord({
      scanId: parsed.scanId,
      target: report.target,
      targetType: report.targetType,
      status: "completed",
      riskScore: report.riskScore,
      durationMs: report.durationMs,
      findingsCount: report.findings.length,
      report,
    });

    if ("error" in saved) {
      return NextResponse.json(
        { error: saved.message ?? "Could not save scan history." },
        { status: saved.error === "unauthorized" ? 401 : 500 },
      );
    }

    return NextResponse.json({
      record: saved.record,
      report: saved.report,
      duplicate: saved.duplicate,
    });
  } catch (error) {
    const durationMs = Date.now() - started;
    const message =
      error instanceof ScanRunnerError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Scan failed.";

    const target = parsed.target?.trim() || "Unknown website";

    const saved = await saveScanHistoryRecord({
      scanId: parsed.scanId,
      target,
      targetType: "website",
      status: "failed",
      riskScore: 0,
      durationMs,
      findingsCount: 0,
      report: null,
      errorMessage: message,
    });

    if ("error" in saved) {
      return NextResponse.json(
        { error: saved.message ?? "Scan failed and could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        record: saved.record,
        report: null,
        duplicate: saved.duplicate,
        error: message,
      },
      { status: 422 },
    );
  }
}
