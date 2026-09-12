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
    <div className="space-y-5">
      <section className="space-y-2.5">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Split method
          </h2>
          <p className="mt-1 text-xs text-scanonix-muted">
            Choose how pages become output files.
          </p>
        </div>

        <div className="grid gap-1.5">
          {MODES.map((option) => {
            const selected = mode === option.value;
            return (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border px-3 py-2.5 transition ${
                  selected
                    ? "border-scanonix-orange bg-scanonix-orange/10 text-foreground"
                    : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50 hover:text-foreground"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="splitMode"
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
      </section>

      {mode === "ranges" && (
        <section className="space-y-2 border-t border-border/80 pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Pages / ranges
          </h2>
          <label htmlFor="page-ranges" className="sr-only">
            Page ranges
          </label>
          <input
            id="page-ranges"
            type="text"
            value={rangeInput}
            onChange={(event) => onRangeInputChange(event.target.value)}
            disabled={disabled}
            placeholder="e.g. 1-3, 5, 8-10"
            className="input-field w-full"
          />
          {rangeError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {rangeError}
            </p>
          ) : (
            <p className="text-xs text-scanonix-muted">
              Each comma-separated entry becomes a separate PDF file.
            </p>
          )}
        </section>
      )}

      {mode === "fixed-interval" && (
        <section className="space-y-2 border-t border-border/80 pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Interval
          </h2>
          <label
            htmlFor="page-interval"
            className="mb-1.5 block text-xs font-medium text-scanonix-muted"
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
            className="input-field w-full max-w-[10rem]"
          />
          <p className="text-xs text-scanonix-muted">
            Example: interval of 2 on a 10-page PDF creates 5 files.
          </p>
        </section>
      )}

      {mode === "individual" && (
        <section className="border-t border-border/80 pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Pages
          </h2>
          <p className="mt-1.5 text-xs text-scanonix-muted">
            Click pages in the workspace to include them in one output PDF.
          </p>
        </section>
      )}
    </div>
  );
}
