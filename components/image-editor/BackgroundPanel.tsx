"use client";

import { useState } from "react";
import {
  BACKGROUND_PRESET_SWATCHES,
  backgroundsEqual,
  createColorBackground,
  createTransparentBackground,
  isValidHexColor,
  normalizeHex,
  type EditorBackground,
} from "@/lib/image-editor/background";

interface BackgroundPanelProps {
  background: EditorBackground;
  onChange: (bg: EditorBackground) => void;
  onReset: () => void;
}

function Swatch({
  label,
  background,
  selected,
  onClick,
}: {
  label: string;
  background: EditorBackground;
  selected: boolean;
  onClick: () => void;
}) {
  const isTransparent = background.type === "transparent";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={[
        "ie-focus-ring flex flex-col items-center gap-2 rounded-[var(--ie-radius-md)] p-2 transition-colors duration-150 lg:p-2.5",
        selected
          ? "bg-[var(--ie-selected-muted)]"
          : "hover:bg-[var(--ie-control-hover)]",
      ].join(" ")}
      onClick={onClick}
    >
      <span
        className={[
          "relative h-11 w-full overflow-hidden rounded-[10px] shadow-[var(--ie-shadow-sm)] ring-1 transition-[box-shadow,ring-color] duration-150 lg:h-12",
          selected
            ? "ring-[var(--ie-accent)]/40"
            : "ring-[var(--ie-border-subtle)]",
        ].join(" ")}
        style={
          isTransparent
            ? {
                backgroundImage:
                  "linear-gradient(45deg,#b0b5c0 25%,transparent 25%),linear-gradient(-45deg,#b0b5c0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#b0b5c0 75%),linear-gradient(-45deg,transparent 75%,#b0b5c0 75%)",
                backgroundSize: "10px 10px",
                backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
                backgroundColor: "#eceef2",
              }
            : { backgroundColor: normalizeHex(background.color) }
        }
      />
      <span
        className={[
          "truncate text-[11px] font-medium lg:text-xs",
          selected ? "text-[var(--ie-text)]" : "text-[var(--ie-text-muted)]",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}

export function BackgroundPanel({
  background,
  onChange,
  onReset,
}: BackgroundPanelProps) {
  const [hex, setHex] = useState(
    background.type === "color" ? normalizeHex(background.color) : "#ffffff",
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--ie-text)] lg:hidden">
          Background
        </p>
        <button
          type="button"
          className="ie-focus-ring ml-auto rounded-[var(--ie-radius-sm)] px-2.5 py-1.5 text-xs font-medium text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)]"
          onClick={onReset}
        >
          Reset background
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
        {BACKGROUND_PRESET_SWATCHES.map((swatch) => (
          <Swatch
            key={swatch.id}
            label={swatch.label}
            background={swatch.background}
            selected={backgroundsEqual(background, swatch.background)}
            onClick={() => {
              onChange(
                swatch.background.type === "transparent"
                  ? createTransparentBackground()
                  : createColorBackground(swatch.background.color),
              );
              if (swatch.background.type === "color") {
                setHex(normalizeHex(swatch.background.color));
              }
            }}
          />
        ))}
      </div>

      <div className="rounded-[var(--ie-radius-lg)] bg-[var(--ie-control)] p-3.5 lg:p-4">
        <p className="mb-2.5 text-[11px] font-medium tracking-[0.04em] text-[var(--ie-text-muted)]">
          Custom color
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={normalizeHex(hex)}
            className="ie-focus-ring h-11 w-12 cursor-pointer rounded-[10px] border-0 bg-transparent p-0 lg:h-11 lg:w-14"
            onChange={(e) => {
              const next = normalizeHex(e.target.value);
              setHex(next);
              onChange(createColorBackground(next));
            }}
          />
          <input
            type="text"
            value={hex}
            className="ie-focus-ring min-w-0 flex-1 rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 font-mono text-sm text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)] transition-shadow duration-150 focus:ring-[var(--ie-accent)]/40"
            onChange={(e) => {
              const raw = e.target.value;
              setHex(raw);
              if (isValidHexColor(raw)) {
                onChange(createColorBackground(raw));
              }
            }}
            onBlur={() => setHex(normalizeHex(hex))}
          />
        </div>
      </div>

      <p className="text-xs leading-snug text-[var(--ie-text-muted)]">
        Transparent areas show a checkerboard in the editor only — never baked
        into exports. JPEG flattens transparent backgrounds onto white.
      </p>
    </div>
  );
}
