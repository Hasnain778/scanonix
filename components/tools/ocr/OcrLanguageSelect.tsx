import type { OcrLanguageCode } from "@/lib/tools/ocr/languages";
import { OCR_LANGUAGES } from "@/lib/tools/ocr/languages";

interface OcrLanguageSelectProps {
  value: OcrLanguageCode;
  onChange: (value: OcrLanguageCode) => void;
  disabled?: boolean;
  id?: string;
  /** Single-row control for the phone file card. Desktop keeps the hint. */
  compact?: boolean;
}

export function OcrLanguageSelect({
  value,
  onChange,
  disabled = false,
  id = "ocr-language",
  compact = false,
}: OcrLanguageSelectProps) {
  return (
    <div className={compact ? "flex min-w-0 items-center gap-2" : "space-y-2"}>
      <label
        htmlFor={id}
        className={
          compact
            ? "shrink-0 text-xs font-semibold text-foreground"
            : "block text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted"
        }
      >
        Language
      </label>
      {compact ? null : (
        <p className="text-xs leading-relaxed text-scanonix-muted">
          Choose the language of the text in your document.
        </p>
      )}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as OcrLanguageCode)}
        disabled={disabled}
        className={compact ? "select-field min-w-0 flex-1" : "select-field w-full"}
      >
        {OCR_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
