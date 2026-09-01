"use client";

import { useCallback, useRef, useState } from "react";
import { CheckerboardBackground } from "@/components/tools/background-remover/CheckerboardBackground";
import type { StudioBackgroundOptions } from "@/lib/tools/background-remover/export-image";
import { resolvePreviewBackgroundStyle } from "@/lib/tools/background-remover/export-image";

interface BeforeAfterSliderProps {
  originalUrl: string;
  resultUrl: string;
  background: StudioBackgroundOptions;
  zoom: number;
}

export function BeforeAfterSlider({
  originalUrl,
  resultUrl,
  background,
  zoom,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const position = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.min(100, Math.max(0, position)));
  }, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    isDragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePosition(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isDragging.current) return;
    updatePosition(event.clientX);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    isDragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const backgroundStyle = resolvePreviewBackgroundStyle(background);
  const scaleStyle = { transform: `scale(${zoom})` };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-scanonix-muted">Before / After</span>
        <span className="text-xs text-scanonix-muted">
          Drag slider to compare · {Math.round(zoom * 100)}% zoom
        </span>
      </div>

      <CheckerboardBackground className="overflow-hidden rounded-2xl border border-border">
        <div
          ref={containerRef}
          className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* After (left) — processed PNG only; never stack original underneath */}
          <div
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ ...backgroundStyle, ...scaleStyle }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={resultUrl}
                src={resultUrl}
                alt="Background removed result"
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          </div>

          {/* Before (right) — original upload only */}
          <div
            className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black/40"
            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
          >
            <div
              className="flex h-full w-full items-center justify-center"
              style={scaleStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={originalUrl}
                src={originalUrl}
                alt="Original image"
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          </div>

          <div
            className="absolute inset-y-0 z-10 w-0.5 bg-scanonix-orange shadow-[0_0_12px_#FF6A00]"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-scanonix-orange bg-surface-raised shadow-lg">
              <svg
                className="h-4 w-4 text-scanonix-orange"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 9l4-4 4 4M8 15l4 4 4-4"
                />
              </svg>
            </div>
          </div>

          <span className="absolute left-3 top-3 z-20 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-scanonix-orange">
            After
          </span>
          <span className="absolute right-3 top-3 z-20 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Before
          </span>
        </div>
      </CheckerboardBackground>
    </div>
  );
}
