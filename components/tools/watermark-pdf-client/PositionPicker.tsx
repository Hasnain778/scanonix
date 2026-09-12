"use client";

import { getPositionLabel } from "@/lib/tools/watermark-pdf";
import type { WatermarkPosition } from "@/lib/tools/watermark-pdf/types";

interface PositionPickerProps {
  value: WatermarkPosition;
  onChange: (position: WatermarkPosition) => void;
  disabled?: boolean;
}

const ROWS: WatermarkPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["center", "center", "center"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

function PlacementMark({
  position,
  selected,
}: {
  position: WatermarkPosition;
  selected: boolean;
}) {
  const isCenter = position === "center";
  const isTop = position.startsWith("top-");
  const isLeft = position.endsWith("left");
  const isRight = position.endsWith("right");

  if (isCenter) {
    return (
      <span
        className={`flex h-8 w-6 items-center justify-center rounded border text-[10px] font-medium ${
          selected
            ? "border-scanonix-orange/60 bg-white/90 text-scanonix-orange"
            : "border-border/80 bg-white/70 text-foreground-muted"
        }`}
      >
        C
      </span>
    );
  }

  const justify = isLeft
    ? "justify-start"
    : isRight
      ? "justify-end"
      : "justify-center";

  return (
    <span
      className={`flex h-full w-full flex-col px-1 py-1 ${
        isTop ? "justify-start" : "justify-end"
      }`}
      aria-hidden="true"
    >
      <span className={`flex w-full ${justify}`}>
        <span
          className={`h-8 w-6 rounded border ${
            selected
              ? "border-scanonix-orange/60 bg-white/90"
              : "border-border/80 bg-white/70"
          }`}
        />
      </span>
    </span>
  );
}

export function PositionPicker({
  value,
  onChange,
  disabled = false,
}: PositionPickerProps) {
  return (
    <div
      data-watermark-position-picker
      className="w-full max-w-[11.5rem]"
      role="group"
      aria-label="Watermark position"
    >
      <div className="rounded-lg border border-border bg-surface-muted/70 p-2 shadow-sm">
        <div className="grid aspect-[3/4] grid-rows-3 gap-1.5 rounded-md border border-border/80 bg-surface p-1.5">
          {ROWS.map((row, rowIndex) => (
            <div
              key={row[0] + rowIndex}
              className="grid grid-cols-3 gap-1.5"
            >
              {row.map((position, columnIndex) => {
                if (position === "center" && !(rowIndex === 1 && columnIndex === 1)) {
                  return (
                    <span
                      key={`spacer-${rowIndex}-${columnIndex}`}
                      className="h-16 w-14"
                      aria-hidden="true"
                    />
                  );
                }

                const selected = value === position;

                return (
                  <button
                    key={position}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={getPositionLabel(position)}
                    title={getPositionLabel(position)}
                    onClick={() => onChange(position)}
                    className={`flex h-16 w-14 flex-col items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-scanonix-orange bg-scanonix-orange/10"
                        : "border-border bg-surface-muted hover:border-scanonix-orange/50"
                    }`}
                  >
                    <PlacementMark position={position} selected={selected} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-scanonix-muted">
        {getPositionLabel(value)}
      </p>
    </div>
  );
}
