"use client";

/**
 * IE-4B professional Image Editor workspace — Text objects.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Crop,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  Maximize2,
  Redo2,
  RotateCcw,
  RotateCw,
  Scaling,
  SlidersHorizontal,
  Sparkles,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { AdjustPanel } from "@/components/image-editor/AdjustPanel";
import { BackgroundPanel } from "@/components/image-editor/BackgroundPanel";
import { CropOverlay } from "@/components/image-editor/CropOverlay";
import { EditorStage } from "@/components/image-editor/EditorStage";
import { FiltersPanel } from "@/components/image-editor/FiltersPanel";
import { PlatformBrandIcon } from "@/components/image-editor/PlatformBrandIcon";
import { TextPanel } from "@/components/image-editor/TextPanel";
import {
  cloneAdjustments,
  type EditorAdjustments,
} from "@/lib/image-editor/adjustments";
import type { EditorBackground } from "@/lib/image-editor/background";
import {
  applyCustomCanvas,
  applyPlacementMode,
  applyPresetToDocument,
  clampZoom,
  createDocumentFromPreset,
  createDocumentFromSource,
  createInitialDocument,
  createInitialViewport,
  isAcceptedEditorFile,
  resetAdjustmentsOnly,
  resetBackgroundOnly,
  resetFilterOnly,
  rotateDocument,
  type ContentPlacementMode,
  type CropRatioId,
  type CropRect,
  type EditorDocument,
  type EditorSourceMeta,
  type EditorTextObject,
  type EditorViewport,
} from "@/lib/image-editor/document";
import {
  clampFilterIntensity,
  cloneFilterState,
  isOriginalFilter,
  type EditorFilterState,
} from "@/lib/image-editor/filters";
import {
  CANVAS_PRESET_FAMILIES,
  CANVAS_PRESETS,
  CUSTOM_PRESET_ID,
  formatCanvasSize,
  getPresetById,
  type CanvasPresetFamily,
} from "@/lib/image-editor/presets";
import {
  clampContentOffsets,
  createCenteredRatioCrop,
  fullImageCrop,
  getCanvasOutputSize,
  getEditedImageSize,
} from "@/lib/image-editor/geometry";
import {
  canRedo,
  canUndo,
  commitDocument,
  createHistory,
  redo,
  replacePresent,
  resetDocument,
  undo,
  type DocumentHistoryState,
} from "@/lib/image-editor/history";
import {
  exportEditorDocument,
  type EditorExportFormat,
} from "@/lib/image-editor/export";
import type { RenderSource } from "@/lib/image-editor/render";
import {
  addTextObject,
  createDefaultTextObject,
  deleteTextObject,
  duplicateTextObject,
  ensureEditorFontsLoaded,
  TEXT_MAX_OBJECTS,
  updateTextInList,
} from "@/lib/image-editor/text";
import {
  ImageNormalizationError,
  normalizeFileToCanvas,
} from "@/lib/image/normalize";

type EditorTool =
  | "resize"
  | "crop"
  | "transform"
  | "adjust"
  | "filters"
  | "background"
  | "text";
type StatusMessage = { tone: "info" | "error" | "success"; text: string } | null;

const CROP_RATIOS: { id: CropRatioId; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "16:9", label: "16:9" },
];

const TOOLS: { id: EditorTool; label: string; icon: typeof Scaling }[] = [
  { id: "resize", label: "Resize", icon: Scaling },
  { id: "crop", label: "Crop", icon: Crop },
  { id: "transform", label: "Transform", icon: RotateCw },
  { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
  { id: "filters", label: "Filters", icon: Sparkles },
  { id: "background", label: "Background", icon: ImageIcon },
  { id: "text", label: "Text", icon: Type },
];

function toolBtnClass(active: boolean): string {
  return [
    "ie-focus-ring group relative flex shrink-0 flex-col items-center justify-center font-medium transition-[background,color,box-shadow] duration-150",
    "min-h-12 min-w-[5.5rem] gap-1.5 rounded-[var(--ie-radius-md)] px-3 py-2.5 text-xs leading-tight",
    "lg:min-h-0 lg:min-w-0 lg:w-full lg:gap-1.5 lg:rounded-[var(--ie-radius-sm)] lg:px-1.5 lg:py-2.5 lg:text-[11px]",
    active
      ? "bg-[var(--ie-selected-muted)] text-[var(--ie-text)] max-lg:text-[var(--ie-accent)] lg:bg-transparent"
      : "text-[var(--ie-text-muted)] hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text-secondary)]",
  ].join(" ");
}

function sectionHeadingClass(): string {
  return "mb-2.5 text-[11px] font-medium tracking-[0.04em] text-[var(--ie-text-muted)] lg:mb-2.5 lg:text-[11px]";
}

function quietActionClass(): string {
  return [
    "ie-focus-ring rounded-[var(--ie-radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
    "text-[var(--ie-text-muted)] hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)]",
    "disabled:opacity-40",
  ].join(" ");
}

function segmentTrackClass(): string {
  return "inline-flex flex-wrap gap-0.5 rounded-[var(--ie-radius-md)] bg-[var(--ie-control)] p-1";
}

function segmentItemClass(active: boolean): string {
  return [
    "ie-focus-ring rounded-[7px] px-3 py-2 text-sm font-medium transition-colors duration-150",
    active
      ? "bg-[var(--ie-surface-elevated)] text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)]"
      : "text-[var(--ie-text-muted)] hover:text-[var(--ie-text-secondary)]",
  ].join(" ");
}

function platformChipClass(active: boolean): string {
  return [
    "ie-focus-ring inline-flex items-center gap-2 rounded-[var(--ie-radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-150",
    "lg:gap-2 lg:px-2.5 lg:py-2",
    active
      ? "bg-[var(--ie-selected)] text-[var(--ie-text)]"
      : "bg-[var(--ie-control)] text-[var(--ie-text-secondary)] hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)]",
  ].join(" ");
}

function presetCardClass(active: boolean): string {
  return [
    "ie-focus-ring group relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-[var(--ie-radius-md)] px-3 py-3 text-left transition-colors duration-150",
    "lg:min-h-[3.35rem] lg:gap-3 lg:px-3.5 lg:py-2.5",
    active
      ? "bg-[var(--ie-selected-muted)]"
      : "bg-[var(--ie-control)] hover:bg-[var(--ie-control-hover)]",
  ].join(" ");
}

export function ImageEditorWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adjustBaseRef = useRef<EditorDocument | null>(null);
  const filterBaseRef = useRef<EditorDocument | null>(null);
  const cropBaseRef = useRef<EditorDocument | null>(null);
  const contentPanBaseRef = useRef<EditorDocument | null>(null);
  const textBaseRef = useRef<EditorDocument | null>(null);

  const [source, setSource] = useState<RenderSource | null>(null);
  const [meta, setMeta] = useState<EditorSourceMeta | null>(null);
  const [history, setHistory] = useState<DocumentHistoryState>(() =>
    createHistory(createInitialDocument()),
  );
  const [viewport, setViewport] = useState<EditorViewport>(() =>
    createInitialViewport(),
  );
  const [tool, setTool] = useState<EditorTool>("resize");
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);  const [family, setFamily] = useState<CanvasPresetFamily>("instagram");
  const [ratioId, setRatioId] = useState<CropRatioId>("free");
  const [customW, setCustomW] = useState("1080");
  const [customH, setCustomH] = useState("1080");
  const [aspectLock, setAspectLock] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<EditorExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(0.92);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);

  const doc = history.present;
  const cropMode = tool === "crop";
  const contentDragMode = tool === "resize";

  const canvasLabel = useMemo(() => {
    if (doc.canvas.presetId && doc.canvas.presetId !== CUSTOM_PRESET_ID) {
      return getPresetById(doc.canvas.presetId)?.label ?? "Canvas";
    }
    if (doc.canvas.presetId === CUSTOM_PRESET_ID) return "Custom";
    return "Original";
  }, [doc.canvas.presetId]);

  const applyDocument = useCallback((next: EditorDocument) => {
    setHistory((prev) => commitDocument(prev, next));
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setStatus(null);
      if (!isAcceptedEditorFile(file)) {
        setStatus({
          tone: "error",
          text: "Unsupported file. Use PNG, JPEG, or WebP.",
        });
        return;
      }
      setBusy(true);
      try {
        const normalized = await normalizeFileToCanvas(file);
        setSource({
          canvas: normalized.canvas,
          width: normalized.width,
          height: normalized.height,
        });
        setMeta({
          width: normalized.width,
          height: normalized.height,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
        });

        let nextDoc: EditorDocument;
        if (pendingPresetId) {
          nextDoc =
            createDocumentFromPreset(pendingPresetId) ??
            createDocumentFromSource(normalized.width, normalized.height);
          setPendingPresetId(null);
        } else if (doc.canvas.presetId && !source) {
          nextDoc = {
            ...doc,
            content: {
              ...doc.content,
              mode: "fill",
              scale: 1,
              offsetX: 0,
              offsetY: 0,
            },
          };
        } else {
          nextDoc = createDocumentFromSource(normalized.width, normalized.height);
        }

        setHistory(createHistory(nextDoc));
        setViewport(createInitialViewport());
        setTool("resize");
        setStatus({ tone: "success", text: "Image loaded" });
      } catch (error) {
        setStatus({
          tone: "error",
          text:
            error instanceof ImageNormalizationError
              ? error.message
              : "Could not decode this image.",
        });
      } finally {
        setBusy(false);
      }
    },
    [doc, pendingPresetId, source],
  );

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadFile(file);
  };

  const selectPresetFirst = (presetId: string) => {
    const next = createDocumentFromPreset(presetId);
    if (!next) return;
    if (!source) {
      setPendingPresetId(presetId);
      setHistory(createHistory(next));
      setViewport(createInitialViewport());
      setStatus({
        tone: "info",
        text: "Canvas ready — upload an image.",
      });
      return;
    }
    applyDocument(applyPresetToDocument(doc, presetId));
    setViewport(createInitialViewport());
  };

  const onViewportPan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      panX: prev.panX + dx,
      panY: prev.panY + dy,
    }));
  }, []);

  const onContentPan = useCallback(
    (dxCanvas: number, dyCanvas: number) => {
      if (!meta) return;
      const imageSize = getEditedImageSize(
        { width: meta.width, height: meta.height },
        doc,
      );
      const canvasSize = getCanvasOutputSize(doc.canvas);
      setHistory((prev) => {
        if (!contentPanBaseRef.current) contentPanBaseRef.current = prev.present;
        const present = prev.present;
        const clamped = clampContentOffsets(
          imageSize,
          canvasSize,
          present.content,
          present.content.offsetX + dxCanvas,
          present.content.offsetY + dyCanvas,
        );
        return replacePresent(prev, {
          ...present,
          content: { ...present.content, ...clamped },
        });
      });
    },
    [doc, meta],
  );

  useEffect(() => {
    if (tool !== "resize") return;
    const onUp = () => {
      const base = contentPanBaseRef.current;
      if (!base) return;
      contentPanBaseRef.current = null;
      setHistory((prev) =>
        commitDocument({ ...prev, present: base }, prev.present),
      );
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [tool]);

  const fitViewport = () => setViewport(createInitialViewport());
  const zoomBy = (factor: number) =>
    setViewport((prev) => ({ ...prev, zoom: clampZoom(prev.zoom * factor) }));

  const onCropLive = useCallback((crop: CropRect) => {
    setHistory((prev) => {
      if (!cropBaseRef.current) cropBaseRef.current = prev.present;
      return replacePresent(prev, { ...prev.present, crop });
    });
  }, []);

  const onCropCommit = useCallback((crop: CropRect) => {
    const base = cropBaseRef.current;
    cropBaseRef.current = null;
    setHistory((prev) => {
      if (!base) return commitDocument(prev, { ...prev.present, crop });
      return commitDocument({ ...prev, present: { ...base } }, { ...base, crop });
    });
  }, []);

  const applyRatio = (id: CropRatioId) => {
    setRatioId(id);
    if (!meta) return;
    const sourceSize = { width: meta.width, height: meta.height };
    const crop =
      id === "free"
        ? doc.crop ?? fullImageCrop(sourceSize)
        : createCenteredRatioCrop(sourceSize, id);
    applyDocument({ ...doc, crop });
  };

  const onAdjustChange = (next: EditorAdjustments) => {
    setHistory((prev) => {
      if (!adjustBaseRef.current) {
        adjustBaseRef.current = prev.present;
      }
      return replacePresent(prev, {
        ...prev.present,
        adjustments: cloneAdjustments(next),
      });
    });
  };

  const onAdjustCommit = () => {
    const base = adjustBaseRef.current;
    if (!base) return;
    adjustBaseRef.current = null;
    setHistory((prev) =>
      commitDocument({ ...prev, present: base }, prev.present),
    );
  };

  const onResetAdjustments = () => {
    applyDocument(resetAdjustmentsOnly(doc));
  };

  const onSelectFilter = (filterId: string) => {
    const next: EditorFilterState = {
      filterId,
      intensity: isOriginalFilter(filterId)
        ? 100
        : doc.filter.filterId === filterId
          ? doc.filter.intensity
          : 100,
    };
    applyDocument({ ...doc, filter: cloneFilterState(next) });
  };

  const onFilterIntensityLive = (intensity: number) => {
    setHistory((prev) => {
      if (!filterBaseRef.current) {
        filterBaseRef.current = prev.present;
      }
      return replacePresent(prev, {
        ...prev.present,
        filter: {
          ...prev.present.filter,
          intensity: clampFilterIntensity(intensity),
        },
      });
    });
  };

  const onFilterIntensityCommit = () => {
    const base = filterBaseRef.current;
    if (!base) return;
    filterBaseRef.current = null;
    setHistory((prev) =>
      commitDocument({ ...prev, present: base }, prev.present),
    );
  };

  const onResetFilter = () => {
    applyDocument(resetFilterOnly(doc));
  };

  const onBackgroundChange = (background: EditorBackground) => {
    applyDocument({ ...doc, background });
  };

  const onResetBackground = () => {
    applyDocument(resetBackgroundOnly(doc));
  };

  const replaceTextsLive = (texts: EditorTextObject[]) => {
    setHistory((prev) => {
      if (!textBaseRef.current) textBaseRef.current = prev.present;
      return replacePresent(prev, { ...prev.present, texts });
    });
  };

  const commitTextTransaction = () => {
    const base = textBaseRef.current;
    if (!base) return;
    textBaseRef.current = null;
    setHistory((prev) =>
      commitDocument({ ...prev, present: base }, prev.present),
    );
  };

  const onAddText = () => {
    void ensureEditorFontsLoaded();
    const created = createDefaultTextObject(doc.canvas.width, doc.canvas.height);
    const next = addTextObject(doc.texts, created);
    if (!next) {
      setStatus({
        tone: "error",
        text: `Text limit reached (${TEXT_MAX_OBJECTS}).`,
      });
      return;
    }
    applyDocument({ ...doc, texts: next });
    setSelectedTextId(created.id);
    setTool("text");
  };

  const onTextContentLive = (text: string) => {
    if (!selectedTextId) return;
    replaceTextsLive(updateTextInList(doc.texts, selectedTextId, { text }));
  };

  const onTextPatchLive = (patch: Partial<EditorTextObject>) => {
    if (!selectedTextId) return;
    replaceTextsLive(updateTextInList(doc.texts, selectedTextId, patch));
  };

  const onTextDuplicate = () => {
    if (!selectedTextId) return;
    const result = duplicateTextObject(doc.texts, selectedTextId);
    if (!result) {
      setStatus({
        tone: "error",
        text: `Text limit reached (${TEXT_MAX_OBJECTS}).`,
      });
      return;
    }
    applyDocument({ ...doc, texts: result.texts });
    setSelectedTextId(result.newId);
  };

  const onTextDelete = useCallback(() => {
    if (!selectedTextId) return;
    applyDocument({
      ...doc,
      texts: deleteTextObject(doc.texts, selectedTextId),
    });
    setSelectedTextId(null);
  }, [applyDocument, doc, selectedTextId]);

  const onTextDragLive = (id: string, x: number, y: number) => {
    replaceTextsLive(updateTextInList(doc.texts, id, { x, y }));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (tool !== "text") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if (e.key === "Escape") {
        setSelectedTextId(null);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !editing &&
        selectedTextId
      ) {
        e.preventDefault();
        onTextDelete();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool, selectedTextId, onTextDelete]);

  const handleReset = () => {
    if (meta) {
      setHistory((prev) =>
        resetDocument(prev, createDocumentFromSource(meta.width, meta.height)),
      );
    } else {
      setHistory((prev) => resetDocument(prev, createInitialDocument()));
    }
    setViewport(createInitialViewport());
    setSelectedTextId(null);
    setTool("resize");
  };

  const handleExport = async () => {
    if (!source || !meta) return;
    setBusy(true);
    try {
      const result = await exportEditorDocument(source, doc, meta.filename, {
        format: exportFormat,
        quality: exportQuality,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      setStatus({ tone: "success", text: `Exported ${result.filename}` });
    } catch {
      setStatus({ tone: "error", text: "Export failed." });
    } finally {
      setBusy(false);
    }
  };

  const applyCustom = () => {
    const next = applyCustomCanvas(doc, Number(customW), Number(customH));
    if (!next) {
      setStatus({ tone: "error", text: "Invalid custom dimensions." });
      return;
    }
    applyDocument(next);
    setViewport(createInitialViewport());
  };

  const familyPresets = CANVAS_PRESETS.filter((p) => p.family === family);

  const contextPanel = (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden p-4 lg:gap-5 lg:p-5">
      {tool === "resize" ? (
        <div className="ie-scroll min-h-0 flex-1 space-y-5 overflow-y-auto pr-0.5 lg:space-y-5">
          <section>
            <p className={sectionHeadingClass()}>Placement</p>
            <div className={segmentTrackClass()} role="group" aria-label="Placement">
              {(["fit", "fill", "original"] as ContentPlacementMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={segmentItemClass(doc.content.mode === mode)}
                    onClick={() => applyDocument(applyPlacementMode(doc, mode))}
                  >
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ),
              )}
            </div>
          </section>

          <section>
            <p className={sectionHeadingClass()}>Platform</p>
            <div className="flex flex-wrap gap-2">
              {CANVAS_PRESET_FAMILIES.filter((f) => f.id !== "custom").map(
                (f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={platformChipClass(family === f.id)}
                    onClick={() => setFamily(f.id)}
                  >
                    <PlatformBrandIcon
                      family={f.id}
                      className="h-[18px] w-[18px] shrink-0 lg:h-4 lg:w-4"
                    />
                    {f.label === "X / Twitter" ? "X" : f.label}
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="space-y-1.5">
            {familyPresets.map((preset) => {
              const selected = doc.canvas.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={presetCardClass(selected)}
                  onClick={() => selectPresetFirst(preset.id)}
                >
                  {selected ? (
                    <span
                      className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--ie-accent)]"
                      aria-hidden
                    />
                  ) : null}
                  <PlatformBrandIcon
                    family={preset.family}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium leading-snug text-[var(--ie-text)]">
                      {preset.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs leading-snug text-[var(--ie-text-muted)]">
                      {formatCanvasSize(preset.width, preset.height)}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>

          <section className="rounded-[var(--ie-radius-lg)] bg-[var(--ie-control)] p-3.5 lg:p-4">
            <p className={sectionHeadingClass()}>Custom size</p>
            <div className="flex items-end gap-3">
              <label className="flex-1 text-xs text-[var(--ie-text-muted)]">
                W
                <input
                  type="number"
                  value={customW}
                  className="ie-focus-ring mt-1.5 w-full rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 text-sm text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)] transition-shadow duration-150 focus:ring-[var(--ie-accent)]/40"
                  onChange={(e) => {
                    const w = e.target.value;
                    setCustomW(w);
                    if (aspectLock) {
                      const prevW = Number(customW) || 1;
                      const prevH = Number(customH) || 1;
                      const r = prevH / prevW;
                      const nw = Number(w);
                      if (Number.isFinite(nw) && nw > 0) {
                        setCustomH(String(Math.round(nw * r)));
                      }
                    }
                  }}
                />
              </label>
              <label className="flex-1 text-xs text-[var(--ie-text-muted)]">
                H
                <input
                  type="number"
                  value={customH}
                  className="ie-focus-ring mt-1.5 w-full rounded-[var(--ie-radius-sm)] border-0 bg-[var(--ie-surface-elevated)] px-3 py-2.5 text-sm text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] outline-none ring-1 ring-[var(--ie-border-subtle)] transition-shadow duration-150 focus:ring-[var(--ie-accent)]/40"
                  onChange={(e) => {
                    const h = e.target.value;
                    setCustomH(h);
                    if (aspectLock) {
                      const prevW = Number(customW) || 1;
                      const prevH = Number(customH) || 1;
                      const r = prevW / prevH;
                      const nh = Number(h);
                      if (Number.isFinite(nh) && nh > 0) {
                        setCustomW(String(Math.round(nh * r)));
                      }
                    }
                  }}
                />
              </label>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-[var(--ie-text-secondary)]">
              <span
                className={[
                  "flex h-4 w-4 items-center justify-center rounded border transition-colors duration-150",
                  aspectLock
                    ? "border-[var(--ie-accent)] bg-[var(--ie-accent)] text-[var(--on-brand)]"
                    : "border-[var(--ie-border-strong)] bg-[var(--ie-surface-elevated)]",
                ].join(" ")}
                aria-hidden
              >
                {aspectLock ? (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                    <path
                      d="M2.5 6.2 5 8.5 9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={aspectLock}
                onChange={(e) => setAspectLock(e.target.checked)}
              />
              Lock aspect
            </label>
            <button
              type="button"
              className="ie-focus-ring mt-3 w-full rounded-[var(--ie-radius-md)] bg-[var(--ie-surface-elevated)] px-3 py-2.5 text-sm font-medium text-[var(--ie-text)] shadow-[var(--ie-shadow-sm)] ring-1 ring-[var(--ie-border-subtle)] transition-colors duration-150 hover:bg-[var(--ie-surface-hover)]"
              onClick={applyCustom}
            >
              Apply custom
            </button>
          </section>
        </div>
      ) : null}

      {tool === "crop" ? (
        <div className="space-y-3">
          <div className={segmentTrackClass()} role="group" aria-label="Crop ratio">
            {CROP_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                className={segmentItemClass(ratioId === ratio.id)}
                onClick={() => applyRatio(ratio.id)}
              >
                {ratio.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={quietActionClass()}
            onClick={() => applyDocument({ ...doc, crop: null })}
          >
            Reset crop
          </button>
        </div>
      ) : null}

      {tool === "transform" ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={platformChipClass(false)}
            onClick={() => applyDocument(rotateDocument(doc, "left"))}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Left
          </button>
          <button
            type="button"
            className={platformChipClass(false)}
            onClick={() => applyDocument(rotateDocument(doc, "right"))}
          >
            <RotateCw className="h-3.5 w-3.5" /> Right
          </button>
          <button
            type="button"
            className={platformChipClass(doc.flipX)}
            onClick={() => applyDocument({ ...doc, flipX: !doc.flipX })}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" /> Flip H
          </button>
          <button
            type="button"
            className={platformChipClass(doc.flipY)}
            onClick={() => applyDocument({ ...doc, flipY: !doc.flipY })}
          >
            <FlipVertical2 className="h-3.5 w-3.5" /> Flip V
          </button>
        </div>
      ) : null}

      {tool === "adjust" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AdjustPanel
            adjustments={doc.adjustments}
            onChange={onAdjustChange}
            onCommit={onAdjustCommit}
            onReset={onResetAdjustments}
          />
        </div>
      ) : null}

      {tool === "filters" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <FiltersPanel
            source={source}
            document={doc}
            filter={doc.filter}
            onSelectFilter={onSelectFilter}
            onIntensityLive={onFilterIntensityLive}
            onIntensityCommit={onFilterIntensityCommit}
            onReset={onResetFilter}
          />
        </div>
      ) : null}

      {tool === "background" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BackgroundPanel
            background={doc.background}
            onChange={onBackgroundChange}
            onReset={onResetBackground}
          />
        </div>
      ) : null}

      {tool === "text" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TextPanel
            texts={doc.texts}
            selectedTextId={selectedTextId}
            onSelectText={setSelectedTextId}
            onAddText={onAddText}
            onContentLive={onTextContentLive}
            onContentCommit={commitTextTransaction}
            onPatchLive={onTextPatchLive}
            onPatchCommit={commitTextTransaction}
            onDuplicate={onTextDuplicate}
            onDelete={onTextDelete}
            canAdd={doc.texts.length < TEXT_MAX_OBJECTS}
          />
        </div>
      ) : null}
    </div>
  );

  const toolRail = (
    <nav
      className="ie-scroll flex flex-nowrap gap-2 lg:h-full lg:min-h-0 lg:w-[72px] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-[var(--ie-border-subtle)] lg:bg-[var(--ie-chrome)] lg:py-3 lg:pl-1.5 lg:pr-1.5"
      aria-label="Editor tools"
    >
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={toolBtnClass(active)}
            onClick={() => setTool(t.id)}
          >
            {active ? (
              <span
                className="absolute left-0 top-1/2 hidden h-6 w-[3px] -translate-y-1/2 rounded-full bg-[var(--ie-accent)] lg:block"
                aria-hidden
              />
            ) : null}
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors duration-150 lg:h-8 lg:w-8",
                active
                  ? "bg-[var(--ie-accent-soft)] text-[var(--ie-accent)]"
                  : "text-current",
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            </span>
            <span
              className={[
                "whitespace-nowrap",
                active ? "text-[var(--ie-accent)] lg:text-[var(--ie-text)]" : "",
              ].join(" ")}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-[var(--ie-border)] bg-[var(--ie-chrome)] shadow-[var(--ie-shadow-md)]"
      data-image-editor-workspace=""
    >
      {/* Editor chrome — below global Navbar; no Scanonix logo duplication */}
      <header className="relative z-10 flex h-12 shrink-0 items-center gap-3 border-b border-[var(--ie-border-subtle)] bg-[var(--ie-chrome)] px-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--ie-text)]">
            Image Editor
          </p>
          <p className="truncate text-[11px] leading-tight text-[var(--ie-text-muted)]">
            {canvasLabel} · {formatCanvasSize(doc.canvas.width, doc.canvas.height)}
            {meta ? ` · ${meta.filename}` : ""}
          </p>
        </div>

        <div className="hidden items-center rounded-[var(--ie-radius-md)] bg-[var(--ie-control)] p-0.5 sm:flex">
          <button
            type="button"
            className="ie-focus-ring rounded-[7px] p-1.5 text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)] disabled:opacity-35"
            disabled={!canUndo(history)}
            aria-label="Undo"
            onClick={() => setHistory((h) => undo(h))}
          >
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="ie-focus-ring rounded-[7px] p-1.5 text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)] disabled:opacity-35"
            disabled={!canRedo(history)}
            aria-label="Redo"
            onClick={() => setHistory((h) => redo(h))}
          >
            <Redo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="mx-0.5 h-4 w-px bg-[var(--ie-border)]" />
          <button
            type="button"
            className="ie-focus-ring rounded-[7px] p-1.5 text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)]"
            aria-label="Fit"
            onClick={fitViewport}
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="ie-focus-ring rounded-[7px] p-1.5 text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)]"
            aria-label="Zoom out"
            onClick={() => zoomBy(1 / 1.25)}
          >
            <ZoomOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="w-10 text-center font-mono text-[11px] tabular-nums text-[var(--ie-text-muted)]">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            type="button"
            className="ie-focus-ring rounded-[7px] p-1.5 text-[var(--ie-text-muted)] transition-colors duration-150 hover:bg-[var(--ie-control-hover)] hover:text-[var(--ie-text)]"
            aria-label="Zoom in"
            onClick={() => zoomBy(1.25)}
          >
            <ZoomIn className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={onFileChange}
        />
        <ActionButton
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">{source ? "Replace" : "Upload"}</span>
        </ActionButton>
        <ActionButton
          type="button"
          size="sm"
          variant="primary"
          disabled={!source || busy}
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          Export
        </ActionButton>
      </header>

      {status ? (
        <p
          className={`relative z-10 shrink-0 px-4 py-1.5 text-[11px] ${
            status.tone === "error"
              ? "bg-red-500/10 text-red-500"
              : status.tone === "success"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-[var(--ie-control)] text-[var(--ie-text-muted)]"
          }`}
          role="status"
        >
          {status.text}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="hidden min-h-0 shrink-0 overflow-hidden lg:flex lg:self-stretch">
          {toolRail}
        </div>

        <div className="relative min-h-0 min-w-0 flex-1 bg-[var(--ie-pasteboard)]">
          {!source &&
          !doc.canvas.presetId &&
          doc.texts.length === 0 &&
          tool !== "text" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-base font-semibold text-[var(--ie-text)]">
                Start with an image or canvas size
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <ActionButton
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload image
                </ActionButton>
                <ActionButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setTool("resize");
                    selectPresetFirst("yt-thumb");
                  }}
                >
                  YouTube Thumbnail
                </ActionButton>
              </div>
            </div>
          ) : (
            <>
              <EditorStage
                source={source}
                document={doc}
                viewport={viewport}
                cropMode={cropMode && !!source}
                contentDragMode={contentDragMode && !!source}
                textInteractMode={tool === "text"}
                selectedTextId={selectedTextId}
                onViewportPan={onViewportPan}
                onContentPan={onContentPan}
                onSelectText={setSelectedTextId}
                onTextDragLive={onTextDragLive}
                onTextDragCommit={commitTextTransaction}
              />
              {source && meta && cropMode ? (
                <CropOverlay
                  sourceSize={{ width: meta.width, height: meta.height }}
                  document={doc}
                  viewport={viewport}
                  ratioId={ratioId}
                  enabled
                  onCropLive={onCropLive}
                  onCropCommit={onCropCommit}
                />
              ) : null}
            </>
          )}
        </div>

        <aside
          className="hidden shrink-0 flex-col border-l border-[var(--ie-border-subtle)] bg-[var(--ie-surface)] lg:flex lg:w-[clamp(360px,27vw,410px)]"
          data-editor-inspector=""
        >
          <div className="border-b border-[var(--ie-border-subtle)] px-5 py-3">
            <p className="text-base font-semibold tracking-tight text-[var(--ie-text)]">
              {TOOLS.find((t) => t.id === tool)?.label}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{contextPanel}</div>
        </aside>
      </div>

      {/* Mobile bottom chrome — safe area for consent */}
      <div
        className="relative z-10 shrink-0 border-t border-[var(--ie-border-subtle)] bg-[var(--ie-chrome)] lg:hidden"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          <button
            type="button"
            className="ie-focus-ring shrink-0 rounded-[var(--ie-radius-sm)] p-2 text-[var(--ie-text-muted)] disabled:opacity-35"
            disabled={!canUndo(history)}
            onClick={() => setHistory((h) => undo(h))}
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="ie-focus-ring shrink-0 rounded-[var(--ie-radius-sm)] p-2 text-[var(--ie-text-muted)] disabled:opacity-35"
            disabled={!canRedo(history)}
            onClick={() => setHistory((h) => redo(h))}
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {toolRail}
          </div>
          <button
            type="button"
            className="ie-focus-ring shrink-0 rounded-[var(--ie-radius-sm)] p-2 text-[var(--ie-text-muted)]"
            onClick={fitViewport}
            aria-label="Fit"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div
          className={`ie-scroll overflow-y-auto border-t border-[var(--ie-border-subtle)] ${
            tool === "adjust" || tool === "filters" || tool === "text"
              ? "max-h-[40vh]"
              : "max-h-[34vh]"
          }`}
        >
          {contextPanel}
        </div>
      </div>

      {exportOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-[18px] border border-[var(--ie-border)] bg-[var(--ie-surface-elevated)] p-5 shadow-[var(--ie-shadow-md)]">
            <p className="text-base font-semibold text-[var(--ie-text)]">Export</p>
            <p className="mt-1 text-xs text-[var(--ie-text-muted)]">
              {formatCanvasSize(doc.canvas.width, doc.canvas.height)} · includes
              filter + adjustments + background + text · viewport ignored
            </p>
            <div className={`mt-4 ${segmentTrackClass()} w-full`}>
              {(["png", "jpeg", "webp"] as EditorExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`${segmentItemClass(exportFormat === fmt)} flex-1 uppercase`}
                  onClick={() => setExportFormat(fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>
            {exportFormat === "jpeg" && doc.background.type === "transparent" ? (
              <p className="mt-3 rounded-[var(--ie-radius-md)] bg-[var(--ie-control)] px-3 py-2 text-[11px] leading-snug text-[var(--ie-text-muted)]">
                JPEG cannot keep transparency. Transparent canvas background
                will flatten onto white.
              </p>
            ) : null}
            {exportFormat !== "png" ? (
              <label className="mt-3 block text-xs text-[var(--ie-text-muted)]">
                Quality {Math.round(exportQuality * 100)}%
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={exportQuality}
                  className="ie-slider mt-2"
                  onChange={(e) => setExportQuality(Number(e.target.value))}
                />
              </label>
            ) : null}
            <div className="mt-4 flex gap-2">
              <ActionButton
                type="button"
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => setExportOpen(false)}
              >
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => void handleExport()}
              >
                Download
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="relative z-20 hidden shrink-0 items-center justify-between border-t border-[var(--ie-border-subtle)] bg-[var(--ie-chrome)] px-4 py-1 text-[10px] text-[var(--ie-text-muted)] sm:flex">
        <span>
          {meta ? `${meta.width}×${meta.height}` : "No image"}
        </span>
        <button
          type="button"
          className="ie-focus-ring rounded px-1.5 py-0.5 transition-colors hover:text-[var(--ie-text)]"
          onClick={handleReset}
        >
          Reset document
        </button>
      </footer>
    </div>
  );
}
