import type { PdfRotationDegrees } from "@/lib/tools/rotate-pdf/types";

interface RotationPanelProps {
  rotation: PdfRotationDegrees;
  applyToAll: boolean;
  selectedCount: number;
  totalPages: number;
  disabled?: boolean;
  onRotationChange: (rotation: PdfRotationDegrees) => void;
  onApplyToAllChange: (applyToAll: boolean) => void;
}

const ROTATION_OPTIONS: {
  value: PdfRotationDegrees;
  label: string;
  hint: string;
}[] = [
  { value: 90, label: "90° clockwise", hint: "Rotate right" },
  { value: 180, label: "180°", hint: "Upside down" },
  { value: 270, label: "90° counter-clockwise", hint: "Rotate left" },
];

export function RotationPanel({
  rotation,
  applyToAll,
  selectedCount,
  totalPages,
  disabled = false,
  onRotationChange,
  onApplyToAllChange,
}: RotationPanelProps) {
  return (
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Rotation</h2>
      <p className="mt-1 text-sm text-scanonix-muted">
        Choose how far to rotate{" "}
        {applyToAll
          ? `all ${totalPages} page${totalPages === 1 ? "" : "s"}`
          : `${selectedCount} selected page${selectedCount === 1 ? "" : "s"}`}
        .
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {ROTATION_OPTIONS.map((option) => {
          const isSelected = rotation === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onRotationChange(option.value)}
              className={`rounded-xl border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "border-scanonix-orange bg-scanonix-orange/15 shadow-sm shadow-scanonix-orange/20"
                  : "border-scanonix-border bg-black/30 hover:border-scanonix-orange/40"
              }`}
              aria-pressed={isSelected}
            >
              <span className="block text-sm font-semibold text-white">
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-scanonix-muted">
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-scanonix-border pt-5">
        <p className="mb-3 text-sm font-medium text-white">Apply rotation to</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplyToAllChange(true)}
            className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 disabled:opacity-50 ${
              applyToAll
                ? "border-scanonix-orange bg-scanonix-orange/15 text-white"
                : "border-scanonix-border bg-black/30 text-scanonix-muted hover:text-white"
            }`}
            aria-pressed={applyToAll}
          >
            All pages
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplyToAllChange(false)}
            className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 disabled:opacity-50 ${
              !applyToAll
                ? "border-scanonix-orange bg-scanonix-orange/15 text-white"
                : "border-scanonix-border bg-black/30 text-scanonix-muted hover:text-white"
            }`}
            aria-pressed={!applyToAll}
          >
            Selected pages only
          </button>
        </div>
      </div>
    </div>
  );
}
