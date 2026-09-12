"use client";

import { useCallback, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
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

const MODE_OPTIONS: {
  mode: QrScannerMode;
  label: string;
  icon: typeof Camera;
}[] = [
  { mode: "camera", label: "Camera", icon: Camera },
  { mode: "upload", label: "Upload image", icon: ImageIcon },
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

  const hasResult = Boolean(result);

  return (
    <div
      className={`mx-auto w-full max-w-2xl space-y-6 overflow-x-hidden sm:space-y-8 md:pb-0 ${
        hasResult ? "pb-40" : "pb-8"
      }`}
    >
      {!result && (
        <header className="space-y-2 text-center sm:text-left">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            QR Scanner
          </h2>
          <p className="text-sm leading-relaxed text-foreground-muted sm:text-base">
            Scan a QR code with your camera or upload an image.
          </p>
        </header>
      )}

      <QrScannerStatusBanner
        scannerState={scannerState}
        message={statusMessage}
      />

      {!result && (
        <>
          <div
            className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-muted p-1.5"
            role="tablist"
            aria-label="QR scan mode"
          >
            {MODE_OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
              const selected = mode === optionMode;
              return (
                <button
                  key={optionMode}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleModeChange(optionMode)}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    selected
                      ? "border border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[var(--shadow-soft)]"
                      : "border border-transparent text-foreground-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={1.75} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
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

            <div className="mt-5 border-t border-border pt-4 pr-24 sm:pr-36 lg:pr-0">
              <QrScannerPrivacyNotice />
            </div>
          </div>

          {(scannerState === "no-qr-found" ||
            scannerState === "permission-denied" ||
            scannerState === "camera-unavailable") && (
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <ActionButton variant="outline" onClick={handleScanAnother}>
                Try again
              </ActionButton>
              {scannerState === "camera-unavailable" && mode === "camera" && (
                <ActionButton
                  variant="outline"
                  onClick={() => handleModeChange("upload")}
                >
                  Upload image
                </ActionButton>
              )}
            </div>
          )}
        </>
      )}

      {result && (
        <>
          <QrResultPanel result={result} onScanAnother={handleScanAnother} />
          {/* ToolFinder FAB shares this band with sticky CTA — right pad keeps privacy readable */}
          <div className="max-md:mb-8 max-md:pb-2 pr-24 sm:pr-36 lg:pr-0">
            <QrScannerPrivacyNotice />
          </div>
        </>
      )}

      <ToolStickyMobileActionBar
        visible={hasResult}
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
