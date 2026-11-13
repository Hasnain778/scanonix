import { NextResponse } from "next/server";

/**
 * Server-only Image Upscaler submission gate.
 * Missing, empty, and unrecognized modes deny. Production never defaults to open.
 */

const USER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UpscaleRolloutEnv {
  UPSCALE_ROLLOUT?: string;
  UPSCALE_ALLOWLIST_USER_IDS?: string;
}

export interface UpscaleSubmissionIdentity {
  sessionUserId: string;
  premiumEntitled: boolean;
}

export type UpscaleSubmissionAuthorization =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

export function upscaleRolloutDeniedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Image upscaling is not available.",
      code: "ROLLOUT_CLOSED",
    },
    { status: 403 },
  );
}

function parseAllowlist(raw: string | undefined): ReadonlySet<string> | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  const ids = new Set<string>();
  for (const part of parts) {
    if (!USER_UUID.test(part)) {
      return null;
    }
    ids.add(part.toLowerCase());
  }

  return ids;
}

function readRolloutEnv(env?: UpscaleRolloutEnv): UpscaleRolloutEnv {
  if (env) {
    return env;
  }

  return {
    UPSCALE_ROLLOUT: process.env.UPSCALE_ROLLOUT,
    UPSCALE_ALLOWLIST_USER_IDS: process.env.UPSCALE_ALLOWLIST_USER_IDS,
  };
}

/**
 * Allow a new submission only for an authenticated premium session.
 * The caller must pass the session user id. Client-supplied ids are not read.
 */
export function authorizeUpscaleSubmission(
  identity: UpscaleSubmissionIdentity,
  env?: UpscaleRolloutEnv,
): UpscaleSubmissionAuthorization {
  if (!identity.premiumEntitled) {
    return { allowed: false, response: upscaleRolloutDeniedResponse() };
  }

  const rollout = readRolloutEnv(env);
  const mode = (rollout.UPSCALE_ROLLOUT ?? "").trim();

  if (mode === "open") {
    return { allowed: true };
  }

  if (mode !== "allowlist") {
    return { allowed: false, response: upscaleRolloutDeniedResponse() };
  }

  const allowlist = parseAllowlist(rollout.UPSCALE_ALLOWLIST_USER_IDS);
  const sessionUserId = identity.sessionUserId.trim().toLowerCase();
  if (!allowlist || !USER_UUID.test(sessionUserId) || !allowlist.has(sessionUserId)) {
    return { allowed: false, response: upscaleRolloutDeniedResponse() };
  }

  return { allowed: true };
}
