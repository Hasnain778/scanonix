"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  EDITOR_FONT_CATEGORY_FILTERS,
  getFontFamily,
  listEditorFonts,
  loadEditorFontFamily,
  type EditorFontCategory,
  type EditorFontFamily,
  type EditorFontFamilyId,
} from "@/lib/image-editor/fonts";

const RECENT_KEY = "scanonix-ie-recent-fonts";
const RECENT_MAX = 6;

function readRecent(): EditorFontFamilyId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string")
      .map((id) => getFontFamily(id).id as EditorFontFamilyId)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function pushRecent(id: EditorFontFamilyId): EditorFontFamilyId[] {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

interface FontPickerProps {
  value: EditorFontFamilyId;
  onChange: (id: EditorFontFamilyId) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EditorFontCategory | "all">("all");
  const [recent, setRecent] = useState<EditorFontFamilyId[]>([]);
  const [readyIds, setReadyIds] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = getFontFamily(value);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
    setQuery("");
    return undefined;
  }, [open]);

  const filtered = useMemo(
    () => listEditorFonts(category, query),
    [category, query],
  );

  const recentFonts = useMemo(
    () =>
      recent
        .map((id) => getFontFamily(id))
        .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i),
    [recent],
  );

  const ensurePreview = useCallback(async (family: EditorFontFamily) => {
    await loadEditorFontFamily(family.id, [family.previewWeight]);
    setReadyIds((prev) =>
      prev[family.id] ? prev : { ...prev, [family.id]: true },
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      const batch = [
        ...recentFonts.slice(0, 4),
        ...filtered.slice(0, 12),
        current,
      ];
      for (const f of batch) {
        if (cancelled) return;
        await ensurePreview(f);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, filtered, recentFonts, current, ensurePreview]);

  const select = async (id: EditorFontFamilyId) => {
    const family = getFontFamily(id);
    await loadEditorFontFamily(id, family.weights);
    setRecent(pushRecent(id as EditorFontFamilyId));
    onChange(id as EditorFontFamilyId);
    setOpen(false);
  };

  const renderRow = (family: EditorFontFamily) => {
    const active = family.id === value;
    const ready = readyIds[family.id] || family.source !== "bundled";
    return (
      <button
        key={family.id}
        type="button"
        className={[
          "ie-focus-ring flex w-full items-center gap-2 rounded-[var(--ie-radius-sm)] px-2.5 py-2 text-left transition-colors duration-150",
          active
            ? "bg-[var(--ie-selected-muted)] text-[var(--ie-text)]"
            : "text-[var(--ie-text)] hover:bg-[var(--ie-control-hover)]",
        ].join(" ")}
        onMouseEnter={() => void ensurePreview(family)}
        onFocus={() => void ensurePreview(family)}
        onClick={() => void select(family.id as EditorFontFamilyId)}
      >
        <span
          className="min-w-0 flex-1 truncate text-[15px] leading-snug"
          style={{
            fontFamily: ready ? family.stack : "var(--font-geist-sans), system-ui, sans-serif",
            fontWeight: Number(family.previewWeight),
          }}
        >
          {family.label}
        </span>
        {active ? (
          <Check
            className="h-3.5 w-3.5 shrink-0 text-[var(--ie-accent)]"
            strokeWidth={2}
          />
        ) : null}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="ie-focus-ring flex w-full items-center justify-between gap-2 rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 text-left text-sm text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)] transition-shadow duration-150 hover:bg-[var(--ie-surface-hover)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="min-w-0 truncate"
          style={{
            fontFamily: current.stack,
            fontWeight: Number(current.previewWeight),
          }}
        >
          {current.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--ie-text-muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-[var(--ie-radius-lg)] border border-[var(--ie-border-subtle)] bg-[var(--ie-surface-elevated)] shadow-[var(--ie-shadow-md)]">
          <div className="border-b border-[var(--ie-border-subtle)] p-2">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ie-text-muted)]"
                strokeWidth={1.75}
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Search fonts"
                className="ie-focus-ring w-full rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-control)] py-2 pl-8 pr-2.5 text-sm text-[var(--ie-text)] outline-none placeholder:text-[var(--ie-text-muted)]"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="ie-scroll mt-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {EDITOR_FONT_CATEGORY_FILTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={[
                    "ie-focus-ring shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
                    category === c.id
                      ? "bg-[var(--ie-selected)] text-[var(--ie-accent)]"
                      : "bg-[var(--ie-control)] text-[var(--ie-text-muted)] hover:text-[var(--ie-text)]",
                  ].join(" ")}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ie-scroll max-h-[min(320px,42vh)] overflow-y-auto p-1.5">
            {!query && category === "all" && recentFonts.length > 0 ? (
              <div className="mb-2">
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-medium tracking-[0.04em] text-[var(--ie-text-muted)]">
                  Recent
                </p>
                {recentFonts.map(renderRow)}
                <div className="mx-2 my-1.5 border-t border-[var(--ie-border-subtle)]" />
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--ie-text-muted)]">
                No fonts match “{query.trim()}”
              </p>
            ) : (
              filtered.map(renderRow)
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
