import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ScanLine,
} from "lucide-react";
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

  // Message uses text-foreground so Bright/Dark both stay readable on tinted shells.
  const styles = {
    loading: "border-scanonix-orange/40 bg-scanonix-orange/10 text-foreground",
    success: "border-green-500/35 bg-green-500/10 text-foreground",
    error: "border-red-500/40 bg-red-500/10 text-foreground",
    idle: "",
  };

  const defaultMessage = message ?? getQrScannerStateMessage(scannerState);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles[resolvedVariant]}`}
      role="status"
      aria-live="polite"
    >
      {resolvedVariant === "loading" && (
        scannerState === "scanning" ? (
          <ScanLine
            className="mt-0.5 h-5 w-5 shrink-0 text-scanonix-orange"
            aria-hidden="true"
            strokeWidth={2}
          />
        ) : (
          <Loader2
            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-scanonix-orange"
            aria-hidden="true"
            strokeWidth={2}
          />
        )
      )}
      {resolvedVariant === "success" && (
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
          aria-hidden="true"
          strokeWidth={2}
        />
      )}
      {resolvedVariant === "error" && (
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
          aria-hidden="true"
          strokeWidth={2}
        />
      )}
      <p className="text-sm font-medium leading-relaxed text-foreground">
        {defaultMessage}
      </p>
    </div>
  );
}
