/**
 * Runtime detection for Vercel serverless vs local native ML/PDF tooling.
 * Server-only — never import from client components.
 */

/** True when running on Vercel's serverless platform. */
export function isVercelServerlessRuntime(): boolean {
  return process.env.VERCEL === "1";
}

/** Windows absolute or backslash executable paths — invalid on Vercel Linux. */
export function isWindowsNativePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[A-Za-z]:[\\/]/.test(trimmed) || (/\\/.test(trimmed) && /\.exe$/i.test(trimmed));
}

/**
 * Local subprocess/binary providers are allowed when not on Vercel, or when the
 * configured path is not a Windows-only filesystem path.
 */
export function isLocalNativeBinaryAllowed(binaryPath: string): boolean {
  if (!binaryPath.trim()) return false;
  if (isVercelServerlessRuntime()) return false;
  if (isWindowsNativePath(binaryPath)) return true;
  return true;
}

/**
 * On Vercel, native providers require an external HTTP service URL.
 * Locally, either a service URL or an allowed local binary/python path works.
 */
export function resolveNativeProviderMode(
  serviceUrl: string,
  localBinaryOrPython: string,
): "service" | "local" | "unconfigured" {
  if (serviceUrl.trim()) return "service";
  if (isLocalNativeBinaryAllowed(localBinaryOrPython)) return "local";
  return "unconfigured";
}

export function nativeProviderUnavailableMessage(toolLabel: string): string {
  if (isVercelServerlessRuntime()) {
    return `${toolLabel} requires an external worker service in production. Configure the corresponding *_SERVICE_URL environment variable on Vercel.`;
  }
  return `${toolLabel} is not configured on this server.`;
}
