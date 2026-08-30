"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import type { DrawStrokePoint } from "@/lib/tools/sign-pdf/signature-assets";
import { createDrawnSignatureAssetFromStrokes } from "@/lib/tools/sign-pdf/signature-assets";

interface SignatureDrawPadProps {
  disabled?: boolean;
  onCancel: () => void;
  onCreated: (asset: Awaited<ReturnType<typeof createDrawnSignatureAssetFromStrokes>>) => void;
}

const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 180;

export function SignatureDrawPad({
  disabled = false,
  onCancel,
  onCreated,
}: SignatureDrawPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<DrawStrokePoint[][]>([]);
  const activeStrokeRef = useRef<DrawStrokePoint[]>([]);
  const drawingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.5;
    context.strokeStyle = "#111111";

    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (let index = 1; index < stroke.length; index += 1) {
        context.lineTo(stroke[index].x, stroke[index].y);
      }
      context.stroke();
    }
  }, []);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>): DrawStrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || isSaving) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    setIsDrawing(true);
    const point = getPoint(event);
    activeStrokeRef.current = [point];
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled || isSaving) return;
    event.preventDefault();
    const point = getPoint(event);
    activeStrokeRef.current.push(point);
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context || activeStrokeRef.current.length < 2) return;

    const stroke = activeStrokeRef.current;
    const last = stroke[stroke.length - 2];
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.5;
    context.strokeStyle = "#111111";
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasInk(true);
  };

  const finishStroke = () => {
    if (activeStrokeRef.current.length > 0) {
      strokesRef.current.push(activeStrokeRef.current);
      activeStrokeRef.current = [];
    }
    drawingRef.current = false;
    setIsDrawing(false);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishStroke();
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = [];
    setHasInk(false);
    setError(undefined);
    redraw();
  };

  const handleAdd = async () => {
    if (!hasInk || isSaving) return;
    setIsSaving(true);
    setError(undefined);
    try {
      const asset = await createDrawnSignatureAssetFromStrokes(
        strokesRef.current,
        crypto.randomUUID(),
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
      );
      onCreated(asset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save signature.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-label="Draw your signature"
        role="img"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full touch-none rounded-xl border border-border bg-transparent ${
          isDrawing ? "cursor-crosshair" : "cursor-crosshair"
        } ${disabled ? "opacity-50" : ""}`}
        style={{ maxHeight: 180 }}
      />
      <p className="text-xs text-foreground-muted">
        Draw with mouse or finger. Use a horizontal stroke like signing on paper.
      </p>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="outline" disabled={disabled || isSaving} onClick={handleClear}>
          Clear
        </ActionButton>
        <ActionButton variant="ghost" disabled={isSaving} onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton
          className="ml-auto"
          disabled={!hasInk || disabled || isSaving}
          loading={isSaving}
          onClick={handleAdd}
        >
          Add signature
        </ActionButton>
      </div>
    </div>
  );
}
