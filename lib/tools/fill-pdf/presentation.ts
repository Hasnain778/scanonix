/** Display-only semantic presentation helpers for Fill PDF Forms (Phase 123D-FIX1). */

import type { FormFieldDescriptor } from "./types";

const GENERIC_EXPORT_ON_VALUES = new Set(["yes", "on", "1", "true"]);

export function isGenericExportOnValue(value: string): boolean {
  return GENERIC_EXPORT_ON_VALUES.has(value.trim().toLowerCase());
}

export function splitHierarchicalFieldName(name: string): {
  parent: string | null;
  leaf: string;
} {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { parent: null, leaf: name };
  }

  return {
    parent: name.slice(0, dotIndex),
    leaf: name.slice(dotIndex + 1),
  };
}

function humanizeWord(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed === trimmed.toUpperCase() && trimmed.length > 1) {
    return trimmed.charAt(0) + trimmed.slice(1).toLowerCase();
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function applyKnownPrefixPattern(text: string): string | null {
  const underscoreIndex = text.indexOf("_");
  if (underscoreIndex <= 0) {
    return null;
  }

  const prefix = text.slice(0, underscoreIndex);
  const suffix = text.slice(underscoreIndex + 1);
  if (!suffix) {
    return null;
  }

  switch (prefix.toLowerCase()) {
    case "name":
      return `${humanizeWord(suffix)} name`;
    case "telephone":
      return `${humanizeWord(suffix)} telephone`;
    case "phone":
      return `${humanizeWord(suffix)} phone`;
    case "address":
      return suffix.match(/^\d+$/) ? `Address ${suffix}` : `${humanizeWord(suffix)} address`;
    default:
      return null;
  }
}

function normalizeSeparators(text: string): string {
  return text
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Display-only label derived from a PDF field or option name. */
export function humanizeFieldDisplayName(name: string): string {
  const knownPattern = applyKnownPrefixPattern(name);
  if (knownPattern) {
    return knownPattern;
  }

  const text = normalizeSeparators(name);

  if (text === text.toUpperCase() && text.length > 1) {
    return text
      .toLowerCase()
      .split(" ")
      .map((word) => humanizeWord(word))
      .join(" ");
  }

  return text
    .split(" ")
    .map((word) => humanizeWord(word))
    .join(" ");
}

/** Display-only label for a checkbox choice within or outside a group. */
export function getCheckboxChoiceLabel(descriptor: FormFieldDescriptor): string {
  const { parent, leaf } = splitHierarchicalFieldName(descriptor.name);

  if (parent && leaf) {
    return humanizeFieldDisplayName(leaf);
  }

  if (
    descriptor.exportOnValue &&
    !isGenericExportOnValue(descriptor.exportOnValue)
  ) {
    return humanizeFieldDisplayName(descriptor.exportOnValue);
  }

  return humanizeFieldDisplayName(descriptor.name);
}

/** Display-only label for radio, dropdown, and option-list entries. */
export function formatChoiceOptionLabel(option: string): string {
  return humanizeFieldDisplayName(option);
}

/** True when a checkbox field exposes multiple distinct widget export values. */
export function hasDistinctWidgetChoices(descriptor: FormFieldDescriptor): boolean {
  if (descriptor.kind !== "CHECKBOX") {
    return false;
  }

  const exportValues = descriptor.widgets
    .map((widget) => widget.widgetExportValue)
    .filter((value): value is string => Boolean(value));

  return exportValues.length >= 2 && new Set(exportValues).size === exportValues.length;
}

/** Display label for a specific widget choice on a field. */
export function getWidgetChoiceLabel(
  descriptor: FormFieldDescriptor,
  widget: FormFieldDescriptor["widgets"][number],
): string {
  if (widget.widgetDisplayLabel) {
    return widget.widgetDisplayLabel;
  }

  if (widget.widgetOptionValue) {
    return formatChoiceOptionLabel(widget.widgetOptionValue);
  }

  if (widget.widgetExportValue) {
    return formatChoiceOptionLabel(widget.widgetExportValue);
  }

  return getCheckboxChoiceLabel(descriptor);
}
