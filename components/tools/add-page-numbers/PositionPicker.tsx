"use client";

import { getPositionLabel } from "@/lib/tools/add-page-numbers";
import type { PageNumberPosition } from "@/lib/tools/add-page-numbers/types";

interface PositionPickerProps {
  value: PageNumberPosition;
  onChange: (position: PageNumberPosition) => void;
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

export function PositionPicker({
  value,
  onChange,
  disabled = false,
}: PositionPickerProps) {
  const rows: PageNumberPosition[][] = [
    ["top-left", "top-center", "top-right"],
    ["bottom-left", "bottom-center", "bottom-right"],
  ];

  return (
    <div
      className="inline-grid grid-cols-3 gap-2"
      role="group"
      aria-label="Page number position"
    >
      {rows.flatMap((row) =>
        row.map((position) => {
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
              className={`flex h-16 w-14 flex-col items-center justify-between rounded-xl border px-2 py-2 transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-scanonix-orange bg-scanonix-orange/10"
                  : "border-scanonix-border bg-black/30 hover:border-scanonix-orange/50"
              }`}
            >
              <PositionDot active={position.startsWith("top-") && selected} />
              <span
                className={`h-8 w-6 rounded border ${
                  selected
                    ? "border-scanonix-orange/60 bg-white/90"
                    : "border-scanonix-border/80 bg-white/70"
                }`}
                aria-hidden="true"
              />
              <PositionDot active={position.startsWith("bottom-") && selected} />
            </button>
          );
        }),
      )}
    </div>
  );
}
