"use client";

import { useState, type ReactNode } from "react";
import type { EditorAdjustments } from "@/lib/image-editor/adjustments";
import {
  ADJUST_SIGNED_MAX,
  ADJUST_SIGNED_MIN,
  ADJUST_UNSIGNED_MAX,
  ADJUST_UNSIGNED_MIN,
  isNeutralAdjustments,
} from "@/lib/image-editor/adjustments";

type SectionId = "light" | "color" | "detail" | "effect";

interface AdjustPanelProps {
  adjustments: EditorAdjustments;
  onChange: (next: EditorAdjustments) => void;
  onCommit: () => void;
  onReset: () => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block py-2.5">
      <span className="mb-2 flex items-center justify-between text-sm text-[var(--ie-text)]">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--ie-text-muted)]">
          {value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        className="ie-slider"
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--ie-border-subtle)] last:border-b-0">
      <button
        type="button"
        className="ie-focus-ring flex w-full items-center justify-between py-2.5 text-left text-[11px] font-medium tracking-[0.04em] text-[var(--ie-text-muted)] transition-colors duration-150 hover:text-[var(--ie-text-secondary)]"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        {title}
        <span className="text-sm leading-none text-[var(--ie-text-muted)]">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="pb-2">{children}</div> : null}
    </div>
  );
}

export function AdjustPanel({
  adjustments: a,
  onChange,
  onCommit,
  onReset,
}: AdjustPanelProps) {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    light: true,
    color: true,
    detail: false,
    effect: false,
  });

  const patch = (key: keyof EditorAdjustments, value: number) => {
    onChange({ ...a, [key]: value });
  };

  const toggle = (id: SectionId) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--ie-text)] lg:hidden">
          Adjust
        </p>
        <button
          type="button"
          className="ie-focus-ring ml-auto rounded-[var(--ie-radius-sm)] px-2.5 py-1.5 text-xs font-medium text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)] disabled:opacity-40"
          disabled={isNeutralAdjustments(a)}
          onClick={onReset}
        >
          Reset adjustments
        </button>
      </div>

      <div className="ie-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
        <Section id="light" title="Light" open={open.light} onToggle={toggle}>
          <SliderRow
            label="Brightness"
            value={a.brightness}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("brightness", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Exposure"
            value={a.exposure}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("exposure", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Contrast"
            value={a.contrast}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("contrast", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Highlights"
            value={a.highlights}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("highlights", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Shadows"
            value={a.shadows}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("shadows", v)}
            onCommit={onCommit}
          />
        </Section>

        <Section id="color" title="Color" open={open.color} onToggle={toggle}>
          <SliderRow
            label="Saturation"
            value={a.saturation}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("saturation", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Vibrance"
            value={a.vibrance}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("vibrance", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Temperature"
            value={a.temperature}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("temperature", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Tint"
            value={a.tint}
            min={ADJUST_SIGNED_MIN}
            max={ADJUST_SIGNED_MAX}
            onChange={(v) => patch("tint", v)}
            onCommit={onCommit}
          />
        </Section>

        <Section id="detail" title="Detail" open={open.detail} onToggle={toggle}>
          <SliderRow
            label="Sharpness"
            value={a.sharpness}
            min={ADJUST_UNSIGNED_MIN}
            max={ADJUST_UNSIGNED_MAX}
            onChange={(v) => patch("sharpness", v)}
            onCommit={onCommit}
          />
          <SliderRow
            label="Blur"
            value={a.blur}
            min={ADJUST_UNSIGNED_MIN}
            max={ADJUST_UNSIGNED_MAX}
            onChange={(v) => patch("blur", v)}
            onCommit={onCommit}
          />
        </Section>

        <Section id="effect" title="Effect" open={open.effect} onToggle={toggle}>
          <SliderRow
            label="Grayscale"
            value={a.grayscale}
            min={ADJUST_UNSIGNED_MIN}
            max={ADJUST_UNSIGNED_MAX}
            onChange={(v) => patch("grayscale", v)}
            onCommit={onCommit}
          />
        </Section>
      </div>
    </div>
  );
}
