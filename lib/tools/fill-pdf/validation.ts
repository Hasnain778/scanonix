import { Encodings } from "@pdf-lib/standard-fonts";
import { MAX_FILL_PDF_TEXT_LENGTH_FALLBACK } from "./limits";
import { validateCheckboxExportValue } from "./checkbox-field-value";
import type { FormFieldDescriptor, FormFieldValue } from "./types";
import { FillPdfError } from "./types";
import { fieldValuesEqual } from "./field-values";

function toCodePoint(character: string): number {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return -1;
  }
  return codePoint;
}

export function containsUnsupportedWinAnsiCharacters(text: string): boolean {
  for (const character of text) {
    if (!Encodings.WinAnsi.canEncodeUnicodeCodePoint(toCodePoint(character))) {
      return true;
    }
  }
  return false;
}

export function findUnsupportedWinAnsiCharacters(text: string): string[] {
  const unsupported: string[] = [];

  for (const character of text) {
    if (!Encodings.WinAnsi.canEncodeUnicodeCodePoint(toCodePoint(character))) {
      if (!unsupported.includes(character)) {
        unsupported.push(character);
      }
    }
  }

  return unsupported;
}

export function validateTextCharacters(text: string): void {
  const unsupported = findUnsupportedWinAnsiCharacters(text);
  if (unsupported.length > 0) {
    throw new FillPdfError(
      "UNSUPPORTED_CHARACTERS",
      `This field contains characters that cannot be exported with standard PDF fonts: ${unsupported.join("")}`,
    );
  }
}

export function validateFieldValue(
  descriptor: FormFieldDescriptor,
  value: FormFieldValue,
): void {
  if (descriptor.readOnly) {
    throw new FillPdfError(
      "READ_ONLY_FIELD",
      `Field "${descriptor.name}" is read-only and cannot be edited.`,
    );
  }

  if (descriptor.kind === "SIGNATURE" || descriptor.kind === "BUTTON") {
    throw new FillPdfError(
      "UNSUPPORTED_FIELD_TYPE",
      `Field "${descriptor.name}" is not supported for filling.`,
    );
  }

  if (value.kind !== descriptor.kind) {
    throw new FillPdfError(
      "INVALID_FIELD_VALUE",
      `Field "${descriptor.name}" expects a ${descriptor.kind} value.`,
    );
  }

  switch (value.kind) {
    case "TEXT": {
      const maxLength = descriptor.maxLength ?? MAX_FILL_PDF_TEXT_LENGTH_FALLBACK;
      if (value.value.length > maxLength) {
        throw new FillPdfError(
          "TEXT_TOO_LONG",
          `Field "${descriptor.name}" exceeds the maximum length of ${maxLength} characters.`,
        );
      }
      validateTextCharacters(value.value);
      return;
    }
    case "CHECKBOX":
      if (value.kind === "CHECKBOX") {
        validateCheckboxExportValue(descriptor, value);
      }
      return;
    case "RADIO": {
      if (value.selected !== null && descriptor.options && !descriptor.options.includes(value.selected)) {
        throw new FillPdfError(
          "INVALID_FIELD_VALUE",
          `Field "${descriptor.name}" does not include option "${value.selected}".`,
        );
      }
      return;
    }
    case "DROPDOWN": {
      if (value.selected !== null && descriptor.options && !descriptor.options.includes(value.selected)) {
        throw new FillPdfError(
          "INVALID_FIELD_VALUE",
          `Field "${descriptor.name}" does not include option "${value.selected}".`,
        );
      }
      return;
    }
    case "OPTION_LIST": {
      if (!descriptor.options) {
        return;
      }
      for (const selected of value.selected) {
        if (!descriptor.options.includes(selected)) {
          throw new FillPdfError(
            "INVALID_FIELD_VALUE",
            `Field "${descriptor.name}" does not include option "${selected}".`,
          );
        }
      }
      return;
    }
    default:
      throw new FillPdfError(
        "UNSUPPORTED_FIELD_TYPE",
        `Field "${descriptor.name}" is not supported for filling.`,
      );
  }
}

export function validateEditState(
  descriptors: FormFieldDescriptor[],
  edits: Record<string, FormFieldValue>,
  initialValues?: Record<string, FormFieldValue>,
): void {
  const descriptorByName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]));

  for (const [name, value] of Object.entries(edits)) {
    const descriptor = descriptorByName.get(name);
    if (!descriptor) {
      continue;
    }

    const initialValue = initialValues?.[name];
    if (initialValue && fieldValuesEqual(initialValue, value)) {
      continue;
    }

    validateFieldValue(descriptor, value);
  }
}
