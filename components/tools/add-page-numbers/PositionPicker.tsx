"use client";

import { getPositionLabel } from "@/lib/tools/add-page-numbers";
import type { PageNumberPosition } from "@/lib/tools/add-page-numbers/types";

interface PositionPickerProps {
  value: PageNumberPosition;
  onChange: (position: PageNumberPosition) => void;
  disabled?: boolean;
}

const ROWS: PageNumberPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

function PlacementMark({ position }: { position: PageNumberPosition }) {
  const isTop = position.startsWith("top-");
  const isLeft = position.endsWith("left");
  const isRight = position.endsWith("right");
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
        <span className="h-1.5 w-3 rounded-[2px] bg-current" />
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
      className="w-full max-w-[11.5rem]"
      role="group"
      aria-label="Page number position"
    >
      <div className="rounded-lg border border-border bg-surface-muted/70 p-2 shadow-sm">
        <div
          className="grid aspect-[3/4] grid-rows-2 gap-1.5 rounded-md border border-border/80 bg-surface p-1.5"
          aria-hidden="false"
        >
          {ROWS.map((row) => (
            <div
              key={row[0]}
              className={`grid grid-cols-3 gap-1.5 ${
                row[0].startsWith("top-") ? "items-start" : "items-end"
              }`}
            >
              {row.map((position) => {
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
                    className={`aspect-square w-full rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/35 disabled:cursor-not-allowed disabled:opacity-45 ${
                      selected
                        ? "border-scanonix-orange bg-scanonix-orange/15 text-scanonix-orange shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_35%,transparent)]"
                        : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
                    }`}
                  >
                    <PlacementMark position={position} />
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
