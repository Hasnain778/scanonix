import type { QrScannerState } from "@/lib/tools/qr-scanner/types";
import { getQrScannerStateMessage } from "@/lib/tools/qr-scanner/types";
import type { ToolStatus } from "@/lib/tools/types";

interface QrScannerStatusBannerProps {
  scannerState: QrScannerState;
  message?: string;
  variant?: ToolStatus;
}

export function QrScannerStatusBanner({
  scannerState,
  message,
  variant,
}: QrScannerStatusBannerProps) {
  const resolvedVariant: ToolStatus =
    variant ??
    (scannerState === "detected"
      ? "success"
      : scannerState === "permission-denied" ||
          scannerState === "camera-unavailable" ||
          scannerState === "no-qr-found"
        ? "error"
        : scannerState === "idle"
          ? "idle"
          : "loading");

  if (resolvedVariant === "idle") {
    return null;
  }

  const styles = {
    loading: "border-scanonix-orange/40 bg-scanonix-orange/10 text-foreground",
    success: "border-green-600/35 bg-green-500/10 text-green-700",
    error: "border-red-500/40 bg-red-500/10 text-red-300",
    idle: "",
  };

  const defaultMessage = message ?? getQrScannerStateMessage(scannerState);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${styles[resolvedVariant]}`}
      role="status"
      aria-live="polite"
    >
      {resolvedVariant === "loading" && (
        <svg
          className="h-5 w-5 animate-spin text-scanonix-orange"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {resolvedVariant === "success" && (
        <svg
          className="h-5 w-5 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {resolvedVariant === "error" && (
        <svg
          className="h-5 w-5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
      <p className="text-sm font-medium">{defaultMessage}</p>
    </div>
  );
}
