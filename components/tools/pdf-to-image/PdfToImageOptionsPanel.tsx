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
}: PdfToImageOptionsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Pages to convert</h2>
        <p className="mt-1 text-sm text-scanonix-muted">
          Choose which pages to export as images.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                mode === option.value
                  ? "border-scanonix-orange bg-scanonix-orange/10"
                  : "border-scanonix-border hover:border-scanonix-orange/40"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="pdfToImageMode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => onModeChange(option.value)}
                disabled={disabled}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-white">
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-scanonix-muted">
                {option.description}
              </span>
            </label>
          ))}
        </div>

        {mode === "ranges" && (
          <div className="mt-6">
            <label
              htmlFor="image-page-ranges"
              className="mb-2 block text-sm font-medium text-white"
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
              className="w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white placeholder:text-scanonix-muted/60 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20 disabled:opacity-50"
            />
            {rangeError ? (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {rangeError}
              </p>
            ) : (
              <p className="mt-2 text-xs text-scanonix-muted">
                Each page in the ranges will be exported as a separate image.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Export settings</h2>
        <p className="mt-1 text-sm text-scanonix-muted">
          Choose format, quality, and resolution.
        </p>

        <div className="mt-6 space-y-6">
          <fieldset disabled={disabled}>
            <legend className="mb-3 text-sm font-medium text-white">
              Format
            </legend>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    format === option.value
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-scanonix-orange"
                      : "border-scanonix-border text-white hover:border-scanonix-orange/40"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
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
            <legend className="mb-3 text-sm font-medium text-white">
              Quality
            </legend>
            <div className="flex flex-wrap gap-2">
              {QUALITIES.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    quality === option.value
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-scanonix-orange"
                      : "border-scanonix-border text-white hover:border-scanonix-orange/40"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
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
              <p className="mt-2 text-xs text-scanonix-muted">
                PNG is always lossless regardless of quality setting.
              </p>
            )}
          </fieldset>

          <fieldset disabled={disabled}>
            <legend className="mb-3 text-sm font-medium text-white">
              Resolution
            </legend>
            <div className="flex flex-wrap gap-2">
              {SCALES.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    scale === option.value
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-scanonix-orange"
                      : "border-scanonix-border text-white hover:border-scanonix-orange/40"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
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
            <p className="mt-2 text-xs text-scanonix-muted">
              Higher resolution produces sharper images with larger file sizes.
            </p>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
