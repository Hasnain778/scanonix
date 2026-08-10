/**
 * Server-only rembg worker auth headers for outbound service calls.
 * Reads env at call time so Vercel runtime secrets are always current.
 */

function readOutboundRembgSecret(): string {
  const raw =
    process.env.REMBG_SERVICE_SECRET?.trim() ||
    process.env.REMBG_WORKER_SECRET?.trim() ||
    "";

  if (!raw) {
    return "";
  }

  // Allow operators who pasted "Bearer <token>" into the env var.
  return raw.replace(/^Bearer\s+/i, "").trim();
}

/** Returns Authorization header for server-to-server rembg worker calls. */
export function buildRembgServiceAuthHeaders(): Record<string, string> {
  const secret = readOutboundRembgSecret();
  if (!secret) {
    return {};
  }

  return { Authorization: `Bearer ${secret}` };
}
