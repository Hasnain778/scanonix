"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorDocument } from "@/lib/image-editor/document";
import {
  getFilterCatalog,
  isOriginalFilter,
  type EditorFilterState,
} from "@/lib/image-editor/filters";
import {
  renderFilterThumbnail,
  type RenderSource,
} from "@/lib/image-editor/render";

interface FiltersPanelProps {
  source: RenderSource | null;
  document: EditorDocument;
  filter: EditorFilterState;
  onSelectFilter: (filterId: string) => void;
  onIntensityLive: (intensity: number) => void;
  onIntensityCommit: () => void;
  onReset: () => void;
}

export function FiltersPanel({
  source,
  document: doc,
  filter,
  onSelectFilter,
  onIntensityLive,
  onIntensityCommit,
  onReset,
}: FiltersPanelProps) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const genRef = useRef(0);
  const catalog = getFilterCatalog();
  const displayThumbs = source ? thumbs : {};

  useEffect(() => {
    if (!source) {
      return;
    }
    const token = ++genRef.current;
    const next: Record<string, string> = {};
    for (const preset of getFilterCatalog()) {
      try {
        const canvas = renderFilterThumbnail(source, doc, preset.id, 96);
        next[preset.id] = canvas.toDataURL("image/jpeg", 0.78);
      } catch {
        /* skip broken thumb */
      }
    }
    if (token === genRef.current) {
      setThumbs(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable thumbs
  }, [source, source?.width, source?.height]);

  const original = isOriginalFilter(filter.filterId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--ie-text)] lg:hidden">
          Filters
        </p>
        <button
          type="button"
          className="ie-focus-ring ml-auto rounded-[var(--ie-radius-sm)] px-2.5 py-1.5 text-xs font-medium text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)] disabled:opacity-40"
          disabled={original && filter.intensity === 100}
          onClick={onReset}
        >
          Reset filter
        </button>
      </div>

      <div className="ie-scroll min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
          {catalog.map((preset) => {
            const selected = filter.filterId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={[
                  "ie-focus-ring group relative overflow-hidden rounded-[var(--ie-radius-md)] text-left transition-all duration-150",
                  selected
                    ? "bg-[var(--ie-selected-muted)]"
                    : "bg-[var(--ie-control)] hover:bg-[var(--ie-control-hover)]",
                ].join(" ")}
                onClick={() => onSelectFilter(preset.id)}
              >
                {selected ? (
                  <span
                    className="absolute inset-y-2 left-0 z-[1] w-[3px] rounded-full bg-[var(--ie-accent)]"
                    aria-hidden
                  />
                ) : null}
                <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--ie-surface)]">
                  {displayThumbs[preset.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayThumbs[preset.id]}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--ie-text-muted)]">
                      …
                    </div>
                  )}
                </div>
                <p className="truncate px-2.5 py-2 text-[13px] font-medium text-[var(--ie-text)] lg:px-3 lg:text-sm">
                  {preset.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--ie-border-subtle)] pt-3">
        <label className="block text-sm text-[var(--ie-text)]">
          <span className="mb-2 flex justify-between">
            <span className="font-medium">Intensity</span>
            <span className="font-mono text-xs tabular-nums text-[var(--ie-text-muted)]">
              {original ? "—" : filter.intensity}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={filter.intensity}
            disabled={original}
            className="ie-slider"
            onChange={(e) => onIntensityLive(Number(e.target.value))}
            onPointerUp={onIntensityCommit}
            onBlur={onIntensityCommit}
          />
        </label>
      </div>
    </div>
  );
}
