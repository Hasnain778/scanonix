/**
 * Server-only Real-ESRGAN worker auth headers for outbound service calls.
 * Reads env at call time so Vercel runtime secrets are always current.
 */

function readOutboundRealEsrganSecret(): string {
  const raw =
    process.env.REALESRGAN_SERVICE_SECRET?.trim() ||
    process.env.REALESRGAN_WORKER_SECRET?.trim() ||
    "";

  if (!raw) {
    return "";
  }

  // Allow operators who pasted "Bearer <token>" into the env var.
  return raw.replace(/^Bearer\s+/i, "").trim();
}

/** Reads REALESRGAN_SERVICE_URL at request time (never from a cached env object). */
export function readRealEsrganServiceUrl(): string {
  return process.env.REALESRGAN_SERVICE_URL?.trim() || "";
}

/** True when a server-to-server worker secret is available at call time. */
export function isRealEsrganServiceAuthConfigured(): boolean {
  return readOutboundRealEsrganSecret().length > 0;
}

/** Returns Authorization header for server-to-server Real-ESRGAN worker calls. */
export function buildRealEsrganServiceAuthHeaders(): Record<string, string> {
  const secret = readOutboundRealEsrganSecret();
  if (!secret) {
    return {};
  }

  return { Authorization: `Bearer ${secret}` };
}

/** Resolved outbound worker request settings (URL + auth headers). */
export function resolveRealEsrganServiceRequest(): {
  serviceUrl: string;
  headers: Record<string, string>;
} {
  return {
    serviceUrl: readRealEsrganServiceUrl(),
    headers: buildRealEsrganServiceAuthHeaders(),
  };
}
