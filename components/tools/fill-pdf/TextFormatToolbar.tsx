"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clampManualFontSize,
  TEXT_FONT_SIZE_MAX,
  TEXT_FONT_SIZE_MIN,
  TEXT_UNDERLINE_SUPPORTED,
  type TextFormatState,
  type TextFontSize,
} from "@/lib/tools/fill-pdf";

interface TextFormatToolbarProps {
  format: TextFormatState;
  disabled?: boolean;
  onChange: (patch: Partial<TextFormatState>) => void;
}

function FormatToggle({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-scanonix-orange/60 bg-scanonix-orange/20 text-white"
          : "border-white/10 text-scanonix-muted hover:border-scanonix-orange/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function DesktopTextFormatControls({
  format,
  disabled,
  onChange,
}: TextFormatToolbarProps) {
  const manualSize =
    format.fontSize === "auto"
      ? null
      : clampManualFontSize(format.fontSize);

  const setManualSize = (next: number) => {
    onChange({ fontSize: clampManualFontSize(next) });
  };

  return (
    <div
      data-fill-pdf-text-format-toolbar
      className="hidden items-center gap-1 sm:flex"
    >
      <FormatToggle
        label="Bold"
        active={format.bold}
        disabled={disabled}
        onClick={() => onChange({ bold: !format.bold })}
      >
        B
      </FormatToggle>
      <FormatToggle
        label="Italic"
        active={format.italic}
        disabled={disabled}
        onClick={() => onChange({ italic: !format.italic })}
      >
        <span className="italic">I</span>
      </FormatToggle>
      {TEXT_UNDERLINE_SUPPORTED && (
        <FormatToggle
          label="Underline"
          active={format.underline}
          disabled={disabled}
          onClick={() => onChange({ underline: !format.underline })}
        >
          <span className="underline">U</span>
        </FormatToggle>
      )}

      <span className="mx-1 h-4 w-px bg-white/10" aria-hidden="true" />

      <label className="sr-only" htmlFor="fill-pdf-font-size-mode">
        Font size
      </label>
      <select
        id="fill-pdf-font-size-mode"
        disabled={disabled}
        value={format.fontSize === "auto" ? "auto" : "manual"}
        onChange={(event) => {
          if (event.target.value === "auto") {
            onChange({ fontSize: "auto" });
            return;
          }

          onChange({
            fontSize: manualSize ?? TEXT_FONT_SIZE_MIN + 6,
          });
        }}
        className="h-7 rounded-md border border-white/10 bg-transparent px-1.5 text-xs text-scanonix-muted hover:border-scanonix-orange/40"
      >
        <option value="auto">Auto</option>
        <option value="manual">Manual</option>
      </select>

      {format.fontSize !== "auto" && (
        <>
          <button
            type="button"
            aria-label="Decrease font size"
            disabled={disabled || (manualSize ?? TEXT_FONT_SIZE_MIN) <= TEXT_FONT_SIZE_MIN}
            onClick={() => setManualSize((manualSize ?? TEXT_FONT_SIZE_MIN) - 1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-white disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[1.75rem] text-center text-xs text-white">
            {manualSize}
          </span>
          <button
            type="button"
            aria-label="Increase font size"
            disabled={disabled || (manualSize ?? TEXT_FONT_SIZE_MAX) >= TEXT_FONT_SIZE_MAX}
            onClick={() => setManualSize((manualSize ?? TEXT_FONT_SIZE_MIN) + 1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-white disabled:opacity-40"
          >
            +
          </button>
        </>
      )}
    </div>
  );
}

function MobileTextFormatControls({
  format,
  disabled,
  onChange,
}: TextFormatToolbarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const manualSize =
    format.fontSize === "auto"
      ? null
      : clampManualFontSize(format.fontSize);

  const setSizeMode = (mode: TextFontSize | "manual") => {
    if (mode === "auto") {
      onChange({ fontSize: "auto" });
      return;
    }

    onChange({ fontSize: manualSize ?? 12 });
  };

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button"
        aria-label="Text formatting"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 items-center rounded-lg border border-white/10 px-2 text-xs font-semibold text-scanonix-muted hover:border-scanonix-orange/40 hover:text-white disabled:opacity-40"
      >
        Aa
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-scanonix-border/80 bg-[#141414] p-2 shadow-xl">
          <div className="flex items-center gap-1">
            <FormatToggle
              label="Bold"
              active={format.bold}
              disabled={disabled}
              onClick={() => onChange({ bold: !format.bold })}
            >
              B
            </FormatToggle>
            <FormatToggle
              label="Italic"
              active={format.italic}
              disabled={disabled}
              onClick={() => onChange({ italic: !format.italic })}
            >
              <span className="italic">I</span>
            </FormatToggle>
            {TEXT_UNDERLINE_SUPPORTED && (
              <FormatToggle
                label="Underline"
                active={format.underline}
                disabled={disabled}
                onClick={() => onChange({ underline: !format.underline })}
              >
                <span className="underline">U</span>
              </FormatToggle>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <label className="block text-[10px] uppercase tracking-wide text-scanonix-muted">
              Size
            </label>
            <select
              disabled={disabled}
              value={format.fontSize === "auto" ? "auto" : "manual"}
              onChange={(event) =>
                setSizeMode(
                  event.target.value === "auto" ? "auto" : "manual",
                )
              }
              className="h-7 w-full rounded-md border border-white/10 bg-transparent px-1.5 text-xs text-white"
            >
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
            {format.fontSize !== "auto" && (
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label="Decrease font size"
                  disabled={disabled || (manualSize ?? TEXT_FONT_SIZE_MIN) <= TEXT_FONT_SIZE_MIN}
                  onClick={() =>
                    onChange({
                      fontSize: clampManualFontSize((manualSize ?? 12) - 1),
                    })
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-scanonix-muted"
                >
                  −
                </button>
                <span className="text-xs text-white">{manualSize} pt</span>
                <button
                  type="button"
                  aria-label="Increase font size"
                  disabled={disabled || (manualSize ?? TEXT_FONT_SIZE_MAX) >= TEXT_FONT_SIZE_MAX}
                  onClick={() =>
                    onChange({
                      fontSize: clampManualFontSize((manualSize ?? 12) + 1),
                    })
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-scanonix-muted"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TextFormatToolbar(props: TextFormatToolbarProps) {
  return (
    <>
      <DesktopTextFormatControls {...props} />
      <MobileTextFormatControls {...props} />
    </>
  );
}
