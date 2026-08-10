import type { SplitMode } from "@/lib/tools/types";

interface SplitModePanelProps {
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  rangeInput: string;
  onRangeInputChange: (value: string) => void;
  interval: number;
  onIntervalChange: (value: number) => void;
  rangeError?: string;
  disabled?: boolean;
}

const MODES: {
  value: SplitMode;
  label: string;
  description: string;
}[] = [
  {
    value: "individual",
    label: "Select pages",
    description: "Pick individual pages to combine into one PDF",
  },
  {
    value: "ranges",
    label: "Page ranges",
    description: "Use formats like 1-3, 5, 8-10",
  },
  {
    value: "every-page",
    label: "Every page",
    description: "Extract each page as a separate PDF",
  },
  {
    value: "fixed-interval",
    label: "Fixed intervals",
    description: "Split every N pages into separate files",
  },
];

export function SplitModePanel({
  mode,
  onModeChange,
  rangeInput,
  onRangeInputChange,
  interval,
  onIntervalChange,
  rangeError,
  disabled = false,
}: SplitModePanelProps) {
  return (
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Split method</h2>
      <p className="mt-1 text-sm text-scanonix-muted">
        Choose how you want to divide your PDF.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
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
              name="splitMode"
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
            htmlFor="page-ranges"
            className="mb-2 block text-sm font-medium text-white"
          >
            Page ranges
          </label>
          <input
            id="page-ranges"
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
              Each range becomes a separate PDF file.
            </p>
          )}
        </div>
      )}

      {mode === "fixed-interval" && (
        <div className="mt-6">
          <label
            htmlFor="page-interval"
            className="mb-2 block text-sm font-medium text-white"
          >
            Pages per file
          </label>
          <input
            id="page-interval"
            type="number"
            min={1}
            value={interval}
            onChange={(event) =>
              onIntervalChange(Math.max(1, Number(event.target.value) || 1))
            }
            disabled={disabled}
            className="w-full max-w-xs rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20 disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-scanonix-muted">
            Example: interval of 2 on a 10-page PDF creates 5 files.
          </p>
        </div>
      )}
    </div>
  );
}
