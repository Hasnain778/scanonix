import type { OcrLanguageCode } from "@/lib/tools/ocr/languages";
import { OCR_LANGUAGES } from "@/lib/tools/ocr/languages";

interface OcrLanguageSelectProps {
  value: OcrLanguageCode;
  onChange: (value: OcrLanguageCode) => void;
  disabled?: boolean;
}

export function OcrLanguageSelect({
  value,
  onChange,
  disabled = false,
}: OcrLanguageSelectProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="ocr-language"
        className="block text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted"
      >
        Language
      </label>
      <p className="text-xs leading-relaxed text-scanonix-muted">
        Choose the language of the text in your document.
      </p>
      <select
        id="ocr-language"
        value={value}
        onChange={(event) => onChange(event.target.value as OcrLanguageCode)}
        disabled={disabled}
        className="select-field w-full"
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
