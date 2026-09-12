import type {
  ImageExportFormat,
  ImageExportQuality,
  ImageExportScale,
  PdfToImageMode,
} from "@/lib/tools/types";

interface PdfToImageOptionsPanelProps {
  mode: PdfToImageMode;
  onModeChange: (mode: PdfToImageMode) => void;
  rangeInput: string;
  onRangeInputChange: (value: string) => void;
  format: ImageExportFormat;
  onFormatChange: (format: ImageExportFormat) => void;
  quality: ImageExportQuality;
  onQualityChange: (quality: ImageExportQuality) => void;
  scale: ImageExportScale;
  onScaleChange: (scale: ImageExportScale) => void;
  rangeError?: string;
  disabled?: boolean;
  /** Compact vertical layout for sticky control rails */
  compact?: boolean;
}

const MODES: {
  value: PdfToImageMode;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "All pages",
    description: "Convert every page in the PDF",
  },
  {
    value: "individual",
    label: "Select pages",
    description: "Pick individual pages to convert",
  },
  {
    value: "ranges",
    label: "Page ranges",
    description: "Use formats like 1-3, 5, 8-10",
  },
];

const FORMATS: { value: ImageExportFormat; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
];

const QUALITIES: { value: ImageExportQuality; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
  { value: "maximum", label: "Maximum" },
];

const SCALES: { value: ImageExportScale; label: string }[] = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
];

function chipClass(selected: boolean, disabled: boolean, compact: boolean) {
  return `cursor-pointer rounded-lg border text-sm font-semibold transition-all duration-200 ${
    compact ? "px-3 py-1.5" : "px-5 py-2.5"
  } ${
    selected
      ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_35%,transparent)]"
      : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/40 hover:bg-surface-muted hover:text-foreground"
  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;
}

function SectionLabel({
  children,
  compact,
}: {
  children: string;
  compact: boolean;
}) {
  return (
    <h2
      className={
        compact
          ? "text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted"
          : "text-lg font-semibold text-foreground"
      }
    >
      {children}
    </h2>
  );
}

export function PdfToImageOptionsPanel({
  mode,
  onModeChange,
  rangeInput,
  onRangeInputChange,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  scale,
  onScaleChange,
  rangeError,
  disabled = false,
  compact = false,
}: PdfToImageOptionsPanelProps) {
  return (
    <div className={compact ? "space-y-5" : "space-y-4"}>
      <section className={compact ? "space-y-2.5" : "rounded-2xl border border-border bg-surface p-4 sm:p-5"}>
        <div>
          <SectionLabel compact={compact}>Pages to convert</SectionLabel>
          {!compact && (
            <p className="mt-1 text-sm text-scanonix-muted">
              Choose which pages to export as images.
            </p>
          )}
        </div>

        <div
          className={
            compact
              ? "grid gap-1.5"
              : "mt-4 grid gap-2 sm:grid-cols-3"
          }
        >
          {MODES.map((option) => {
            const selected = mode === option.value;
            return (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border transition-all duration-200 ${
                  compact ? "px-3 py-2.5" : "p-4"
                } ${
                  selected
                    ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                    : "border-border/80 bg-surface-muted/80 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="pdfToImageMode"
                  value={option.value}
                  checked={selected}
                  onChange={() => onModeChange(option.value)}
                  disabled={disabled}
                  className="sr-only"
                />
                <span
                  className={`block text-sm font-semibold ${
                    selected ? "text-foreground" : "text-scanonix-muted"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-scanonix-muted">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>

        {mode === "ranges" && (
          <div className={compact ? "pt-1" : "mt-4"}>
            <label
              htmlFor="image-page-ranges"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Page ranges
            </label>
            <input
              id="image-page-ranges"
              type="text"
              value={rangeInput}
              onChange={(event) => onRangeInputChange(event.target.value)}
              disabled={disabled}
              placeholder="e.g. 1-3, 5, 8-10"
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-scanonix-muted/60 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20 disabled:opacity-50"
            />
            {rangeError ? (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {rangeError}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-scanonix-muted">
                Each page in the ranges will be exported as a separate image.
              </p>
            )}
          </div>
        )}
      </section>

      <section
        className={
          compact
            ? "space-y-3 border-t border-border/80 pt-5"
            : "rounded-2xl border border-border bg-surface p-4 sm:p-5"
        }
      >
        <div>
          <SectionLabel compact={compact}>Export settings</SectionLabel>
          {!compact && (
            <p className="mt-1 text-sm text-scanonix-muted">
              Choose format, quality, and resolution.
            </p>
          )}
        </div>

        <div className={compact ? "space-y-3.5" : "mt-4 space-y-4"}>
          <fieldset disabled={disabled}>
            <legend className="mb-1.5 text-xs font-medium text-foreground">
              Format
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((option) => (
                <label
                  key={option.value}
                  className={chipClass(
                    format === option.value,
                    disabled,
                    compact,
                  )}
                >
                  <input
                    type="radio"
                    name="imageFormat"
                    value={option.value}
                    checked={format === option.value}
                    onChange={() => onFormatChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={disabled}>
            <legend className="mb-1.5 text-xs font-medium text-foreground">
              Quality
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {QUALITIES.map((option) => (
                <label
                  key={option.value}
                  className={chipClass(
                    quality === option.value,
                    disabled,
                    compact,
                  )}
                >
                  <input
                    type="radio"
                    name="imageQuality"
                    value={option.value}
                    checked={quality === option.value}
                    onChange={() => onQualityChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {format === "png" && (
              <p className="mt-1.5 text-[11px] text-scanonix-muted">
                PNG is always lossless regardless of quality setting.
              </p>
            )}
          </fieldset>

          <fieldset disabled={disabled}>
            <legend className="mb-1.5 text-xs font-medium text-foreground">
              Resolution
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {SCALES.map((option) => (
                <label
                  key={option.value}
                  className={chipClass(scale === option.value, disabled, compact)}
                >
                  <input
                    type="radio"
                    name="imageScale"
                    value={option.value}
                    checked={scale === option.value}
                    onChange={() => onScaleChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-scanonix-muted">
              Higher resolution produces sharper images with larger file sizes.
            </p>
          </fieldset>
        </div>
      </section>
    </div>
  );
}
