"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { QrCameraScanner } from "@/components/tools/qr-scanner/QrCameraScanner";
import { QrResultPanel } from "@/components/tools/qr-scanner/QrResultPanel";
import { QrScannerPrivacyNotice } from "@/components/tools/qr-scanner/QrScannerPrivacyNotice";
import { QrScannerStatusBanner } from "@/components/tools/qr-scanner/QrScannerStatusBanner";
import { QrUploadScanner } from "@/components/tools/qr-scanner/QrUploadScanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import type {
  ParsedQrResult,
  QrScannerMode,
  QrScannerState,
} from "@/lib/tools/qr-scanner/types";

const MODE_OPTIONS: { mode: QrScannerMode; label: string }[] = [
  { mode: "camera", label: "Camera" },
  { mode: "upload", label: "Upload image" },
];

export function QrScannerTool() {
  const [mode, setMode] = useState<QrScannerMode>("camera");
  const [scannerState, setScannerState] = useState<QrScannerState>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [result, setResult] = useState<ParsedQrResult | null>(null);
  const [uploadSession, setUploadSession] = useState(0);

  const handleScanAnother = useCallback(() => {
    setResult(null);
    setScannerState("idle");
    setStatusMessage(undefined);
    setUploadSession((current) => current + 1);
  }, []);

  const handleModeChange = useCallback(
    (nextMode: QrScannerMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
      handleScanAnother();
    },
    [handleScanAnother, mode],
  );

  const handleDetected = useCallback(async (detected: ParsedQrResult) => {
    const gate = await gateToolOperation("qr-scanner");
    if (!gate.ok) {
      setScannerState("idle");
      setStatusMessage(gate.message);
      return;
    }

    const attempt = createProcessAttempt("qr-scanner");
    if (!attempt?.markStarted()) return;

    setResult(detected);
    attempt.success(1);
    setStatusMessage(undefined);
  }, []);

  const handleStateChange = useCallback(
    (state: QrScannerState, message?: string) => {
      setScannerState(state);
      setStatusMessage(message);
    },
    [],
  );

  return (
    <div className="space-y-8">
      <QrScannerStatusBanner
        scannerState={scannerState}
        message={statusMessage}
      />

      {!result && (
        <>
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map(({ mode: optionMode, label }) => (
              <button
                key={optionMode}
                type="button"
                onClick={() => handleModeChange(optionMode)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  mode === optionMode
                    ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground"
                    : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            {mode === "camera" ? (
              <QrCameraScanner
                scannerState={scannerState}
                onStateChange={handleStateChange}
                onDetected={handleDetected}
                disabled={Boolean(result)}
              />
            ) : (
              <QrUploadScanner
                key={uploadSession}
                onStateChange={handleStateChange}
                onDetected={handleDetected}
                disabled={Boolean(result)}
              />
            )}

            <div className="mt-4 border-t border-scanonix-border pt-4">
              <QrScannerPrivacyNotice />
            </div>
          </div>

          {(scannerState === "no-qr-found" ||
            scannerState === "permission-denied" ||
            scannerState === "camera-unavailable") && (
            <div className="flex justify-center">
              <ActionButton variant="outline" onClick={handleScanAnother}>
                Try again
              </ActionButton>
            </div>
          )}
        </>
      )}

      {result && (
        <>
          <QrResultPanel result={result} onScanAnother={handleScanAnother} />
          <QrScannerPrivacyNotice />
        </>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(result)}
        primaryLabel="Copy result"
        onPrimaryClick={async () => {
          if (!result) return;
          try {
            await navigator.clipboard.writeText(result.raw);
          } catch {
            // Clipboard may be unavailable on some mobile browsers.
          }
        }}
        secondaryLabel="Scan another"
        onSecondaryClick={handleScanAnother}
      />
    </div>
  );
}
