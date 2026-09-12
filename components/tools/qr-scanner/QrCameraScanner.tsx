"use client";

import { useCallback, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
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
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 sm:p-8">
      <div className="relative aspect-square w-full max-w-[14rem] sm:max-w-xs">
        <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-sm border-l-[3px] border-t-[3px] border-scanonix-orange" />
        <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-sm border-r-[3px] border-t-[3px] border-scanonix-orange" />
        <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-sm border-b-[3px] border-l-[3px] border-scanonix-orange" />
        <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-sm border-b-[3px] border-r-[3px] border-scanonix-orange" />
      </div>
      <p className="rounded-full bg-black/55 px-3 py-1.5 text-center text-xs font-medium text-white sm:text-sm">
        Align QR code inside the frame
      </p>
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
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-scanonix-orange">
                <Camera className="h-7 w-7" aria-hidden="true" strokeWidth={1.75} />
              </div>
              <p className="max-w-sm text-sm text-white/80">
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
