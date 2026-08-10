export const AUTO_DETECT_LABEL = "Auto Detect" as const;

export const TRANSLATION_MAX_CHARACTERS = 5_000;

export interface TranslationLanguage {
  label: string;
  rtl?: boolean;
}

/** Target languages — 77 major world languages. */
export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { label: "English" },
  { label: "Spanish" },
  { label: "French" },
  { label: "German" },
  { label: "Italian" },
  { label: "Portuguese" },
  { label: "Dutch" },
  { label: "Polish" },
  { label: "Russian" },
  { label: "Ukrainian" },
  { label: "Turkish" },
  { label: "Arabic", rtl: true },
  { label: "Persian", rtl: true },
  { label: "Urdu", rtl: true },
  { label: "Hindi" },
  { label: "Bengali" },
  { label: "Punjabi" },
  { label: "Gujarati" },
  { label: "Marathi" },
  { label: "Tamil" },
  { label: "Telugu" },
  { label: "Kannada" },
  { label: "Malayalam" },
  { label: "Nepali" },
  { label: "Sinhala" },
  { label: "Chinese Simplified" },
  { label: "Chinese Traditional" },
  { label: "Japanese" },
  { label: "Korean" },
  { label: "Vietnamese" },
  { label: "Thai" },
  { label: "Indonesian" },
  { label: "Malay" },
  { label: "Filipino" },
  { label: "Hebrew", rtl: true },
  { label: "Greek" },
  { label: "Romanian" },
  { label: "Hungarian" },
  { label: "Czech" },
  { label: "Slovak" },
  { label: "Bulgarian" },
  { label: "Croatian" },
  { label: "Serbian" },
  { label: "Slovenian" },
  { label: "Swedish" },
  { label: "Norwegian" },
  { label: "Danish" },
  { label: "Finnish" },
  { label: "Estonian" },
  { label: "Latvian" },
  { label: "Lithuanian" },
  { label: "Albanian" },
  { label: "Macedonian" },
  { label: "Bosnian" },
  { label: "Georgian" },
  { label: "Armenian" },
  { label: "Azerbaijani" },
  { label: "Kazakh" },
  { label: "Uzbek" },
  { label: "Mongolian" },
  { label: "Swahili" },
  { label: "Afrikaans" },
  { label: "Amharic" },
  { label: "Somali" },
  { label: "Hausa" },
  { label: "Yoruba" },
  { label: "Igbo" },
  { label: "Zulu" },
  { label: "Xhosa" },
  { label: "Irish" },
  { label: "Welsh" },
  { label: "Scottish Gaelic" },
  { label: "Icelandic" },
  { label: "Catalan" },
  { label: "Basque" },
  { label: "Galician" },
  { label: "Latin" },
  { label: "Esperanto" },
] as const;

export const SOURCE_LANGUAGE_OPTIONS = [
  AUTO_DETECT_LABEL,
  ...TRANSLATION_LANGUAGES.map((language) => language.label),
] as const;

const TARGET_LABELS = new Set(TRANSLATION_LANGUAGES.map((language) => language.label));
const SOURCE_LABELS = new Set(SOURCE_LANGUAGE_OPTIONS);
const RTL_LABELS = new Set(
  TRANSLATION_LANGUAGES.filter((language) => language.rtl).map((language) => language.label),
);

export function isValidTargetLanguage(language: string): boolean {
  return TARGET_LABELS.has(language.trim());
}

export function isValidSourceLanguage(language: string): boolean {
  return SOURCE_LABELS.has(language.trim());
}

export function isAutoDetect(language: string): boolean {
  return language.trim() === AUTO_DETECT_LABEL;
}

export function isRtlLanguage(language: string): boolean {
  return RTL_LABELS.has(language.trim());
}
