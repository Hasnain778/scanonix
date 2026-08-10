const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function sanitizeTextInput(value: string, maxLength = 120): string {
  return value.replace(CONTROL_CHARS, "").trim().slice(0, maxLength);
}

export function validateOptionalText(
  value: string,
  label: string,
  maxLength = 120,
): string | null {
  const trimmed = sanitizeTextInput(value, maxLength);
  if (!trimmed) {
    return null;
  }
  if (trimmed.length < 2) {
    return `${label} must be at least 2 characters.`;
  }
  return null;
}

export function validateTimeZone(value: string): string | null {
  const trimmed = sanitizeTextInput(value, 64);
  if (!trimmed) {
    return null;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return null;
  } catch {
    return "Select a valid time zone.";
  }
}

export function validateCountry(value: string): string | null {
  const trimmed = sanitizeTextInput(value, 80);
  if (!trimmed) {
    return null;
  }
  if (trimmed.length < 2) {
    return "Country must be at least 2 characters.";
  }
  return null;
}
