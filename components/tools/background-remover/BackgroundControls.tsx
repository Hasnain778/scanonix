import { ActionButton } from "@/components/ui/ActionButton";
import type { BackgroundPreviewMode } from "@/lib/tools/background-remover/types";

interface BackgroundControlsProps {
  backgroundMode: BackgroundPreviewMode;
  customColor: string;
  disabled?: boolean;
  isDownloading?: boolean;
  onBackgroundModeChange: (mode: BackgroundPreviewMode) => void;
  onCustomColorChange: (color: string) => void;
  onDownload: () => void;
  onStartOver: () => void;
}

const MODE_OPTIONS: {
  mode: BackgroundPreviewMode;
  label: string;
}[] = [
  { mode: "transparent", label: "Transparent" },
  { mode: "white", label: "White" },
  { mode: "black", label: "Black" },
  { mode: "custom", label: "Custom" },
];

export function BackgroundControls({
  backgroundMode,
  customColor,
  disabled = false,
  isDownloading = false,
  onBackgroundModeChange,
  onCustomColorChange,
  onDownload,
  onStartOver,
}: BackgroundControlsProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-sm font-medium text-foreground">Background</p>
        <div className="flex flex-wrap gap-2">
          {MODE_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onBackgroundModeChange(mode)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                backgroundMode === mode
                  ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground"
                  : "border-scanonix-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {backgroundMode === "custom" && (
          <div className="mt-4 flex items-center gap-3">
            <label
              htmlFor="custom-bg-color"
              className="text-sm text-scanonix-muted"
            >
              Pick a colour
            </label>
            <input
              id="custom-bg-color"
              type="color"
              value={customColor}
              disabled={disabled}
              onChange={(event) => onCustomColorChange(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-scanonix-border bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="font-mono text-sm text-scanonix-muted">
              {customColor.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ActionButton
          size="lg"
          className="w-full sm:w-auto"
          loading={isDownloading}
          disabled={disabled || isDownloading}
          onClick={onDownload}
        >
          Download PNG
        </ActionButton>
        <ActionButton
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
          disabled={disabled || isDownloading}
          onClick={onStartOver}
        >
          Start over
        </ActionButton>
      </div>
    </div>
  );
}
