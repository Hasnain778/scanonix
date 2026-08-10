import type { PageOrientation, PageSize } from "@/lib/tools/types";

interface PdfOptionsPanelProps {
  pageSize: PageSize;
  orientation: PageOrientation;
  onPageSizeChange: (size: PageSize) => void;
  onOrientationChange: (orientation: PageOrientation) => void;
  disabled?: boolean;
}

const PAGE_SIZE_OPTIONS: { value: PageSize; label: string; description: string }[] =
  [
    { value: "a4", label: "A4", description: "210 × 297 mm" },
    { value: "letter", label: "Letter", description: "8.5 × 11 in" },
    {
      value: "fit",
      label: "Fit Image",
      description: "Page matches image size",
    },
  ];

const ORIENTATION_OPTIONS: {
  value: PageOrientation;
  label: string;
}[] = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

export function PdfOptionsPanel({
  pageSize,
  orientation,
  onPageSizeChange,
  onOrientationChange,
  disabled = false,
}: PdfOptionsPanelProps) {
  return (
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">PDF options</h2>
      <p className="mt-1 text-sm text-scanonix-muted">
        Configure page layout before conversion.
      </p>

      <div className="mt-6 space-y-6">
        <fieldset disabled={disabled}>
          <legend className="mb-3 text-sm font-medium text-white">
            Page size
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PAGE_SIZE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                  pageSize === option.value
                    ? "border-scanonix-orange bg-scanonix-orange/10"
                    : "border-scanonix-border hover:border-scanonix-orange/40"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="pageSize"
                  value={option.value}
                  checked={pageSize === option.value}
                  onChange={() => onPageSizeChange(option.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-white">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-scanonix-muted">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={disabled || pageSize === "fit"}>
          <legend className="mb-3 text-sm font-medium text-white">
            Orientation
          </legend>
          <div className="flex gap-2">
            {ORIENTATION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                  orientation === option.value
                    ? "border-scanonix-orange bg-scanonix-orange/10"
                    : "border-scanonix-border hover:border-scanonix-orange/40"
                } ${disabled || pageSize === "fit" ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="orientation"
                  value={option.value}
                  checked={orientation === option.value}
                  onChange={() => onOrientationChange(option.value)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-white">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          {pageSize === "fit" && (
            <p className="mt-2 text-xs text-scanonix-muted">
              Orientation follows each image when using Fit Image.
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
}
