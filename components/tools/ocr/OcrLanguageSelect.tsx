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
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <label
        htmlFor="ocr-language"
        className="block text-lg font-semibold text-white"
      >
        Language
      </label>
      <p className="mt-1 text-sm text-scanonix-muted">
        Choose the language of the text in your document.
      </p>
      <select
        id="ocr-language"
        value={value}
        onChange={(event) => onChange(event.target.value as OcrLanguageCode)}
        disabled={disabled}
        className="mt-4 w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20 disabled:opacity-50"
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
