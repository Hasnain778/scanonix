"use client";

import { useCallback, useEffect, useRef } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { decodeQrFromVideoFrame } from "@/lib/tools/qr-scanner/decode-qr";
import type { ParsedQrResult, QrScannerState } from "@/lib/tools/qr-scanner/types";

interface QrCameraScannerProps {
  scannerState: QrScannerState;
  onStateChange: (state: QrScannerState) => void;
  onDetected: (result: ParsedQrResult) => void;
  disabled?: boolean;
}

function ScanningFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
      <div className="relative aspect-square w-full max-w-xs sm:max-w-sm">
        <span className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-scanonix-orange" />
        <span className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-scanonix-orange" />
        <span className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-scanonix-orange" />
        <span className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-scanonix-orange" />
        <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-scanonix-orange/70" />
      </div>
    </div>
  );
}

export function QrCameraScanner({
  scannerState,
  onStateChange,
  onDetected,
  disabled = false,
}: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  const onDetectedRef = useRef(onDetected);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const stopCamera = useCallback(() => {
    isActiveRef.current = false;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (disabled || isActiveRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      onStateChange("camera-unavailable");
      return;
    }

    stopCamera();
    onStateChange("initialising");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;

      if (!video) {
        stopCamera();
        onStateChange("camera-unavailable");
        return;
      }

      video.srcObject = stream;
      await video.play();

      isActiveRef.current = true;
      onStateChangeRef.current("scanning");

      const runScan = () => {
        if (!isActiveRef.current) {
          return;
        }

        const activeVideo = videoRef.current;
        const activeCanvas = canvasRef.current;

        if (!activeVideo || !activeCanvas) {
          return;
        }

        const result = decodeQrFromVideoFrame(activeVideo, activeCanvas);
        if (result) {
          stopCamera();
          onDetectedRef.current(result);
          onStateChangeRef.current("detected");
          return;
        }

        animationRef.current = requestAnimationFrame(runScan);
      };

      animationRef.current = requestAnimationFrame(runScan);
    } catch (error) {
      stopCamera();

      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
      ) {
        onStateChange("permission-denied");
        return;
      }

      onStateChange("camera-unavailable");
    }
  }, [disabled, onStateChange, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const isCameraRunning =
    scannerState === "initialising" || scannerState === "scanning";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-scanonix-border bg-black">
        <div className="relative aspect-[4/3] w-full bg-black">
          <video
            ref={videoRef}
            className={`h-full w-full object-cover ${isCameraRunning ? "block" : "hidden"}`}
            playsInline
            muted
            aria-label="Camera preview for QR scanning"
          />
          {!isCameraRunning && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-scanonix-border bg-scanonix-surface text-scanonix-orange">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <p className="max-w-sm text-sm text-scanonix-muted">
                Allow camera access to scan QR codes live. Your camera feed stays
                on this device.
              </p>
            </div>
          )}
          {scannerState === "scanning" && <ScanningFrame />}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="flex flex-col gap-3 sm:flex-row">
        {!isCameraRunning ? (
          <ActionButton
            size="lg"
            className="w-full sm:w-auto"
            disabled={disabled}
            onClick={startCamera}
          >
            Start camera
          </ActionButton>
        ) : (
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              stopCamera();
              onStateChange("idle");
            }}
          >
            Stop camera
          </ActionButton>
        )}
      </div>
    </div>
  );
}
