import type { PdfRotationDegrees } from "@/lib/tools/rotate-pdf/types";

interface RotationPanelProps {
  rotation: PdfRotationDegrees;
  applyToAll: boolean;
  selectedCount: number;
  totalPages: number;
  disabled?: boolean;
  onRotationChange: (rotation: PdfRotationDegrees) => void;
  onApplyToAllChange: (applyToAll: boolean) => void;
  /** Compact vertical layout for sticky control rails */
  compact?: boolean;
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

export function RotationPanel({
  rotation,
  applyToAll,
  selectedCount,
  totalPages,
  disabled = false,
  onRotationChange,
  onApplyToAllChange,
  compact = false,
}: RotationPanelProps) {
  return (
    <div className={compact ? "space-y-5" : "space-y-4"}>
      <section
        className={
          compact
            ? "space-y-2.5"
            : "rounded-2xl border border-border bg-surface p-5 sm:p-6"
        }
      >
        <div>
          <SectionLabel compact={compact}>Rotation</SectionLabel>
          {!compact && (
            <p className="mt-1 text-sm text-scanonix-muted">
              Choose how far to rotate{" "}
              {applyToAll
                ? `all ${totalPages} page${totalPages === 1 ? "" : "s"}`
                : `${selectedCount} selected page${selectedCount === 1 ? "" : "s"}`}
              .
            </p>
          )}
          {compact && (
            <p className="mt-1 text-[11px] leading-snug text-scanonix-muted">
              {applyToAll
                ? `All ${totalPages} page${totalPages === 1 ? "" : "s"}`
                : `${selectedCount} selected`}
            </p>
          )}
        </div>

        <div className={compact ? "grid gap-1.5" : "mt-5 grid gap-3 sm:grid-cols-3"}>
          {ROTATION_OPTIONS.map((option) => {
            const isSelected = rotation === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => onRotationChange(option.value)}
                className={`rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                  compact ? "px-3 py-2.5" : "px-4 py-4"
                } ${
                  isSelected
                    ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                    : "border-border/80 bg-surface-muted/80 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
                }`}
                aria-pressed={isSelected}
              >
                <span
                  className={`block text-sm font-semibold ${
                    isSelected ? "text-foreground" : "text-scanonix-muted"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-scanonix-muted">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className={
          compact
            ? "space-y-2.5 border-t border-border/80 pt-4"
            : "mt-6 border-t border-border pt-5"
        }
      >
        <SectionLabel compact={compact}>Apply rotation to</SectionLabel>
        <div className={compact ? "grid gap-1.5" : "mt-3 flex flex-col gap-2 sm:flex-row"}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplyToAllChange(true)}
            className={`rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 disabled:opacity-50 ${
              compact ? "px-3 py-2.5 text-left" : "px-4 py-3"
            } ${
              applyToAll
                ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                : "border-border/80 bg-surface-muted/80 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
            }`}
            aria-pressed={applyToAll}
          >
            All pages
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplyToAllChange(false)}
            className={`rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 disabled:opacity-50 ${
              compact ? "px-3 py-2.5 text-left" : "px-4 py-3"
            } ${
              !applyToAll
                ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                : "border-border/80 bg-surface-muted/80 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
            }`}
            aria-pressed={!applyToAll}
          >
            Selected pages only
          </button>
        </div>
      </section>
    </div>
  );
}
