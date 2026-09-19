"use client";

import { useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Trash2,
  Type,
} from "lucide-react";
import type { EditorTextObject } from "@/lib/image-editor/document";
import { FontPicker } from "@/components/image-editor/FontPicker";
import {
  TEXT_FONT_SIZE_MAX,
  TEXT_FONT_SIZE_MIN,
  TEXT_MAX_LENGTH,
  type EditorTextAlign,
  type EditorTextWeight,
  normalizeTextColor,
} from "@/lib/image-editor/text";
import {
  getFontFamily,
  getWeightLabel,
  normalizeFontWeight,
  type EditorFontWeight,
} from "@/lib/image-editor/fonts";

interface TextPanelProps {
  texts: EditorTextObject[];
  selectedTextId: string | null;
  onSelectText: (id: string | null) => void;
  onAddText: () => void;
  onContentLive: (text: string) => void;
  onContentCommit: () => void;
  onPatchLive: (patch: Partial<EditorTextObject>) => void;
  onPatchCommit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canAdd: boolean;
}

function sectionLabel(text: string) {
  return (
    <p className="mb-2.5 text-[11px] font-medium tracking-[0.04em] text-[var(--ie-text-muted)]">
      {text}
    </p>
  );
}

function segmentTrack() {
  return "inline-flex w-full gap-0.5 rounded-[var(--ie-radius-md)] bg-[var(--ie-control)] p-1";
}

function segmentItem(active: boolean) {
  return [
    "ie-focus-ring flex flex-1 items-center justify-center gap-1 rounded-[7px] px-2 py-2 text-sm font-medium transition-colors duration-150",
    active
      ? "bg-[var(--ie-surface-elevated)] text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)]"
      : "text-[var(--ie-text-muted)] hover:text-[var(--ie-text-secondary)]",
  ].join(" ");
}

export function TextPanel({
  texts,
  selectedTextId,
  onSelectText,
  onAddText,
  onContentLive,
  onContentCommit,
  onPatchLive,
  onPatchCommit,
  onDuplicate,
  onDelete,
  canAdd,
}: TextPanelProps) {
  const selected = texts.find((t) => t.id === selectedTextId) ?? null;
  const selectedColor = selected?.color ?? "#000000";
  const [hexDraft, setHexDraft] = useState(selectedColor);
  const [hexSyncKey, setHexSyncKey] = useState(
    `${selected?.id ?? ""}:${selectedColor}`,
  );
  const nextHexSyncKey = `${selected?.id ?? ""}:${selectedColor}`;
  if (nextHexSyncKey !== hexSyncKey) {
    setHexSyncKey(nextHexSyncKey);
    setHexDraft(selectedColor);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--ie-text)] lg:hidden">
          Text
        </p>
        <button
          type="button"
          className="ie-focus-ring ml-auto inline-flex items-center gap-2 rounded-[var(--ie-radius-md)] bg-[var(--ie-accent)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--ie-shadow-sm)] transition-opacity duration-150 hover:opacity-95 disabled:opacity-40"
          disabled={!canAdd}
          onClick={onAddText}
        >
          <Type className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Add text
        </button>
      </div>

      {!selected ? (
        <div className="rounded-[var(--ie-radius-lg)] bg-[var(--ie-control)] px-3.5 py-4">
          <p className="text-sm text-[var(--ie-text-secondary)]">
            {texts.length === 0
              ? "Add text to place a caption or title on your canvas."
              : "Select a text object on the canvas, or add another."}
          </p>
          {texts.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {texts.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="ie-focus-ring w-full truncate rounded-[var(--ie-radius-sm)] px-2.5 py-2 text-left text-sm text-[var(--ie-text)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)]"
                    onClick={() => onSelectText(t.id)}
                  >
                    {t.text.trim() || `Text ${i + 1}`}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="ie-scroll min-h-0 flex-1 space-y-5 overflow-y-auto pr-0.5">
          <section>
            {sectionLabel("Content")}
            <textarea
              value={selected.text}
              rows={4}
              maxLength={TEXT_MAX_LENGTH}
              className="ie-focus-ring w-full resize-y rounded-[var(--ie-radius-md)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)] transition-shadow duration-150 focus:ring-[var(--ie-accent)]/40"
              onChange={(e) => onContentLive(e.target.value)}
              onBlur={onContentCommit}
            />
          </section>

          <section>
            {sectionLabel("Typography")}
            <label className="mb-3 block text-xs text-[var(--ie-text-muted)]">
              Font
              <div className="mt-1.5">
                <FontPicker
                  value={selected.fontFamilyId}
                  onChange={(id) => {
                    onPatchLive({
                      fontFamilyId: id,
                      fontWeight: normalizeFontWeight(id, selected.fontWeight),
                    });
                    onPatchCommit();
                  }}
                />
              </div>
            </label>

            <label className="mb-3 block text-xs text-[var(--ie-text-muted)]">
              Size
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={TEXT_FONT_SIZE_MIN}
                  max={TEXT_FONT_SIZE_MAX}
                  value={selected.fontSize}
                  className="ie-focus-ring w-full rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 text-sm text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)]"
                  onChange={(e) =>
                    onPatchLive({ fontSize: Number(e.target.value) })
                  }
                  onBlur={onPatchCommit}
                />
                <span className="shrink-0 font-mono text-xs text-[var(--ie-text-muted)]">
                  px
                </span>
              </div>
            </label>

            <div className="mb-3">
              <p className="mb-1.5 text-xs text-[var(--ie-text-muted)]">Weight</p>
              <div className={segmentTrack()} role="group" aria-label="Weight">
                {getFontFamily(selected.fontFamilyId).weights.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={segmentItem(selected.fontWeight === w)}
                    onClick={() => {
                      onPatchLive({
                        fontWeight: normalizeFontWeight(
                          selected.fontFamilyId,
                          w,
                        ) as EditorTextWeight,
                      });
                      onPatchCommit();
                    }}
                  >
                    {getWeightLabel(w as EditorFontWeight)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-[var(--ie-text-muted)]">
                Alignment
              </p>
              <div className={segmentTrack()} role="group" aria-label="Alignment">
                {(
                  [
                    ["left", AlignLeft],
                    ["center", AlignCenter],
                    ["right", AlignRight],
                  ] as [EditorTextAlign, typeof AlignLeft][]
                ).map(([align, Icon]) => (
                  <button
                    key={align}
                    type="button"
                    className={segmentItem(selected.align === align)}
                    aria-label={align}
                    onClick={() => {
                      onPatchLive({ align });
                      onPatchCommit();
                    }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            {sectionLabel("Appearance")}
            <div className="mb-3 flex items-center gap-3">
              <input
                type="color"
                value={normalizeTextColor(hexDraft) ?? "#000000"}
                className="ie-focus-ring h-11 w-12 cursor-pointer rounded-[10px] border-0 bg-transparent p-0"
                onChange={(e) => {
                  const next = e.target.value;
                  setHexDraft(next);
                  onPatchLive({ color: next });
                  onPatchCommit();
                }}
              />
              <input
                type="text"
                value={hexDraft}
                className="ie-focus-ring min-w-0 flex-1 rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 font-mono text-sm text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)]"
                onChange={(e) => {
                  const raw = e.target.value;
                  setHexDraft(raw);
                  if (normalizeTextColor(raw)) {
                    onPatchLive({ color: raw });
                  }
                }}
                onBlur={() => {
                  const n = normalizeTextColor(hexDraft);
                  if (n) {
                    setHexDraft(n);
                    onPatchLive({ color: n });
                    onPatchCommit();
                  } else {
                    setHexDraft(selected.color);
                  }
                }}
              />
            </div>

            <label className="block text-sm text-[var(--ie-text)]">
              <span className="mb-2 flex justify-between">
                <span className="font-medium">Opacity</span>
                <span className="font-mono text-xs tabular-nums text-[var(--ie-text-muted)]">
                  {selected.opacity}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={selected.opacity}
                className="ie-slider"
                onChange={(e) =>
                  onPatchLive({ opacity: Number(e.target.value) })
                }
                onPointerUp={onPatchCommit}
                onKeyUp={onPatchCommit}
                onBlur={onPatchCommit}
              />
            </label>
          </section>

          <section>
            {sectionLabel("Transform")}
            <label className="block text-sm text-[var(--ie-text)]">
              <span className="mb-2 flex justify-between">
                <span className="font-medium">Rotation</span>
                <span className="font-mono text-xs tabular-nums text-[var(--ie-text-muted)]">
                  {selected.rotation}°
                </span>
              </span>
              <input
                type="range"
                min={-180}
                max={180}
                value={selected.rotation}
                className="ie-slider"
                onChange={(e) =>
                  onPatchLive({ rotation: Number(e.target.value) })
                }
                onPointerUp={onPatchCommit}
                onKeyUp={onPatchCommit}
                onBlur={onPatchCommit}
              />
            </label>
            <div className="mt-2 flex gap-2">
              {[-90, 0, 90].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className="ie-focus-ring flex-1 rounded-[var(--ie-radius-sm)] bg-[var(--ie-control)] px-2 py-2 text-xs font-medium text-[var(--ie-text-secondary)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)]"
                  onClick={() => {
                    onPatchLive({ rotation: deg });
                    onPatchCommit();
                  }}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </section>

          <section className="flex gap-2 pb-2">
            <button
              type="button"
              className="ie-focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--ie-radius-md)] bg-[var(--ie-control)] px-3 py-2.5 text-sm font-medium text-[var(--ie-text)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)]"
              onClick={onDuplicate}
            >
              <Copy className="h-4 w-4" strokeWidth={1.75} />
              Duplicate
            </button>
            <button
              type="button"
              className="ie-focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--ie-radius-md)] bg-[var(--ie-control)] px-3 py-2.5 text-sm font-medium text-red-400 transition-colors duration-150 hover:bg-[var(--ie-control-hover)]"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              Delete
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
