"use client";

import { getPositionLabel } from "@/lib/tools/watermark-pdf";
import type { WatermarkPosition } from "@/lib/tools/watermark-pdf/types";

interface PositionPickerProps {
  value: WatermarkPosition;
  onChange: (position: WatermarkPosition) => void;
  disabled?: boolean;
}

function PositionDot({ active }: { active: boolean }) {
  return (
    <span
      className={`block h-2 w-2 rounded-full ${
        active ? "bg-scanonix-orange" : "bg-scanonix-muted/50"
      }`}
      aria-hidden="true"
    />
  );
}

const ROWS: WatermarkPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["center", "center", "center"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

export function PositionPicker({
  value,
  onChange,
  disabled = false,
}: PositionPickerProps) {
  return (
    <div
      data-watermark-position-picker
      className="inline-grid grid-cols-3 gap-2"
      role="group"
      aria-label="Watermark position"
    >
      {ROWS.flatMap((row, rowIndex) =>
        row.map((position, columnIndex) => {
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
          const isCenter = position === "center";
          const isTop = position.startsWith("top-");
          const isBottom = position.startsWith("bottom-");

          return (
            <button
              key={position}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={getPositionLabel(position)}
              title={getPositionLabel(position)}
              onClick={() => onChange(position)}
              className={`flex h-16 w-14 flex-col items-center justify-between rounded-xl border px-2 py-2 transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-scanonix-orange bg-scanonix-orange/10"
                  : "border-scanonix-border bg-black/30 hover:border-scanonix-orange/50"
              }`}
            >
              {isCenter ? (
                <>
                  <PositionDot active={selected} />
                  <span
                    className={`flex h-8 w-6 items-center justify-center rounded border text-[10px] font-medium ${
                      selected
                        ? "border-scanonix-orange/60 bg-white/90 text-scanonix-orange"
                        : "border-scanonix-border/80 bg-white/70 text-scanonix-muted"
                    }`}
                  >
                    C
                  </span>
                  <PositionDot active={selected} />
                </>
              ) : (
                <>
                  <PositionDot active={isTop && selected} />
                  <span
                    className={`h-8 w-6 rounded border ${
                      selected
                        ? "border-scanonix-orange/60 bg-white/90"
                        : "border-scanonix-border/80 bg-white/70"
                    }`}
                    aria-hidden="true"
                  />
                  <PositionDot active={isBottom && selected} />
                </>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
