import { NextResponse } from "next/server";
import { basename } from "node:path";
import { isSupabaseConfigured } from "@/config/env";
import { requirePremiumAiPlan } from "@/lib/plan/access";
import { getJobForUser } from "@/lib/upscale-jobs/repository";
import { getSignedResultUrl } from "@/lib/upscale-jobs/storage";
import { outputMimeForFormat } from "@/lib/tools/shared/image-validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROUTE = "/api/tools/image/upscale/jobs/[id]/result";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function sanitizeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, "/"));
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "upscaled.jpg";
}

function resultFileName(scale: number, format: string | null): string {
  const ext = format === "png" ? "png" : "jpg";
  return sanitizeFileName(`upscaled-${scale}x.${ext}`);
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Async upscaling is not configured.", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const access = await requirePremiumAiPlan(ROUTE);
  if (access instanceof NextResponse) {
    return access;
  }

  const { id: jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Job id is required." }, { status: 400 });
  }

  try {
    const job = await getJobForUser(access.user.id, jobId);
    if (!job) {
      return NextResponse.json({ error: "Upscale job not found." }, { status: 404 });
    }

    if (job.status !== "completed") {
      return NextResponse.json(
        { error: "Upscale result is not ready yet.", code: "NOT_READY" },
        { status: 409 },
      );
    }

    const expiresAt = Date.parse(job.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return NextResponse.json(
        { error: "Upscale result has expired.", code: "EXPIRED" },
        { status: 410 },
      );
    }

    if (!job.output_storage_path) {
      return NextResponse.json(
        { error: "Upscale result is missing.", code: "MISSING_RESULT" },
        { status: 500 },
      );
    }

    const signedUrl = await getSignedResultUrl(job.output_storage_path);
    const fileName = resultFileName(job.scale, job.output_format);
    const contentType = outputMimeForFormat(job.output_format ?? "jpg");

    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Could not fetch upscaled result." },
        { status: 502 },
      );
    }

    const bytes = await upstream.arrayBuffer();
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    };

    if (job.input_size_bytes) {
      headers["X-Original-Size"] = String(job.input_size_bytes);
    }
    if (job.output_size_bytes) {
      headers["X-Output-Size"] = String(job.output_size_bytes);
    }
    if (job.output_width) {
      headers["X-Output-Width"] = String(job.output_width);
    }
    if (job.output_height) {
      headers["X-Output-Height"] = String(job.output_height);
    }
    if (job.input_width) {
      headers["X-Original-Width"] = String(job.input_width);
    }
    if (job.input_height) {
      headers["X-Original-Height"] = String(job.input_height);
    }

    return new NextResponse(bytes, { status: 200, headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not download upscale result.",
      },
      { status: 500 },
    );
  }
}
