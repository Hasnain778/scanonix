import tls from "node:tls";
import { ScanRunnerError } from "@/lib/scan/types";
import { SCAN_LIMITS } from "@/lib/scan/website/constants";
import type { SslCertificateInfo } from "@/lib/scan/website/types";

function parseCertificateDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
}

function certField(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function inspectSsl(hostname: string, port = 443): Promise<SslCertificateInfo> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        ALPNProtocols: ["http/1.1", "h2"],
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          const validTo = parseCertificateDate(cert.valid_to);
          const validFrom = parseCertificateDate(cert.valid_from);
          const authorized = Boolean(socket.authorized);
          const verificationError = socket.authorizationError;
          const verificationMessage =
            typeof verificationError === "string"
              ? verificationError
              : verificationError instanceof Error
                ? verificationError.message
                : null;
          const daysRemaining = daysUntil(validTo);
          const valid =
            authorized ||
            (daysRemaining !== null && daysRemaining >= 0 && Boolean(cert.subject?.CN));

          resolve({
            enabled: true,
            valid,
            subject: certField(cert.subject?.CN) ?? certField(cert.subject?.O),
            issuer: certField(cert.issuer?.O) ?? certField(cert.issuer?.CN),
            validFrom,
            validTo,
            daysRemaining,
            tlsVersion: socket.getProtocol(),
            error:
              !valid && verificationMessage
                ? verificationMessage
                : daysRemaining !== null && daysRemaining < 0
                  ? "Certificate has expired."
                  : null,
          });
        } catch (error) {
          resolve({
            enabled: true,
            valid: false,
            subject: null,
            issuer: null,
            validFrom: null,
            validTo: null,
            daysRemaining: null,
            tlsVersion: socket.getProtocol() ?? null,
            error: error instanceof Error ? error.message : "Could not read certificate.",
          });
        } finally {
          socket.end();
        }
      },
    );

    socket.setTimeout(SCAN_LIMITS.tlsTimeoutMs, () => {
      socket.destroy();
      if (Date.now() - started >= SCAN_LIMITS.tlsTimeoutMs) {
        resolve({
          enabled: true,
          valid: false,
          subject: null,
          issuer: null,
          validFrom: null,
          validTo: null,
          daysRemaining: null,
          tlsVersion: null,
          error: "TLS handshake timed out.",
        });
      }
    });

    socket.on("error", (error) => {
      resolve({
        enabled: false,
        valid: false,
        subject: null,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        tlsVersion: null,
        error: error.message,
      });
    });
  });
}

export async function inspectSslForUrl(finalUrl: string): Promise<SslCertificateInfo> {
  let parsed: URL;
  try {
    parsed = new URL(finalUrl);
  } catch {
    throw new ScanRunnerError("invalid_target", "Invalid final URL for SSL inspection.");
  }

  if (parsed.protocol !== "https:") {
    return {
      enabled: false,
      valid: false,
      subject: null,
      issuer: null,
      validFrom: null,
      validTo: null,
      daysRemaining: null,
      tlsVersion: null,
      error: "HTTPS is not enabled for the final URL.",
    };
  }

  return inspectSsl(parsed.hostname);
}
