"use client";

import type { ChangeEvent, CSSProperties, FocusEvent } from "react";
import { hasDistinctWidgetChoices } from "@/lib/tools/fill-pdf";
import {
  cssFontFamilyForFormat,
  getVisiblePageHeightFromWidget,
  pdfPointsToCssPixels,
  resolveEffectiveFontSize,
  type TextFormatState,
} from "@/lib/tools/fill-pdf/text-appearance";
import type { PageFieldOverlayEntry } from "@/lib/tools/fill-pdf/preview-geometry";
import {
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setOptionListFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
} from "@/lib/tools/fill-pdf/field-values";
import type {
  FormEditState,
  FormFieldDescriptor,
  FormFieldValue,
} from "@/lib/tools/fill-pdf/types";

interface DirectFormFieldOverlayProps {
  overlay: PageFieldOverlayEntry;
  descriptor: FormFieldDescriptor;
  value: FormFieldValue;
  editState: FormEditState;
  textFormat?: TextFormatState;
  pageDisplayHeightPx?: number;
  selected?: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (nextState: FormEditState, fieldName: string) => void;
  onSelect: (fieldName: string) => void;
}

function buildTextAppearanceStyle(
  descriptor: FormFieldDescriptor,
  format: TextFormatState | undefined,
  text: string,
  pageDisplayHeightPx: number | undefined,
): Pick<CSSProperties, "fontSize" | "fontFamily" | "fontWeight" | "fontStyle" | "lineHeight"> {
  if (!format || pageDisplayHeightPx === undefined) {
    return {
      fontSize: "11px",
      lineHeight: 1.2,
    };
  }

  const fontSizePt = resolveEffectiveFontSize(format, descriptor, text);
  const visiblePageHeightPt = getVisiblePageHeightFromWidget(descriptor);
  const fontSizePx =
    visiblePageHeightPt !== undefined
      ? pdfPointsToCssPixels(fontSizePt, pageDisplayHeightPx, visiblePageHeightPt)
      : fontSizePt;

  return {
    fontSize: `${fontSizePx}px`,
    fontFamily: cssFontFamilyForFormat(format),
    fontWeight: format.bold ? 700 : 400,
    fontStyle: format.italic ? "italic" : "normal",
    lineHeight: 1.15,
  };
}

function overlayPositionStyle(style: PageFieldOverlayEntry["style"]): CSSProperties {
  return {
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
  };
}

function focusRingClass(selected: boolean, error?: boolean): string {
  if (error) {
    return "ring-2 ring-red-400 ring-offset-1 ring-offset-transparent";
  }

  return selected
    ? "ring-2 ring-scanonix-orange ring-offset-1 ring-offset-transparent"
    : "hover:ring-1 hover:ring-scanonix-orange/40 focus-visible:ring-2 focus-visible:ring-scanonix-orange";
}

export function DirectFormFieldOverlay({
  overlay,
  descriptor,
  value,
  editState,
  textFormat,
  pageDisplayHeightPx,
  selected = false,
  disabled = false,
  error,
  onChange,
  onSelect,
}: DirectFormFieldOverlayProps) {
  const isDisabled = disabled || overlay.readOnly;
  const positionStyle = overlayPositionStyle(overlay.style);
  const widget = descriptor.widgets[overlay.widgetIndex];
  const ariaLabel =
    overlay.widgetDisplayLabel ??
    (widget?.widgetDisplayLabel ?? descriptor.name);

  const handleFocus = () => onSelect(overlay.fieldName);

  if (overlay.kind === "BUTTON") {
    return null;
  }

  if (overlay.kind === "SIGNATURE") {
    return (
      <div
        className={`pointer-events-auto absolute flex items-center justify-center rounded border border-dashed border-scanonix-border/60 bg-black/5 text-[10px] leading-tight text-scanonix-muted ${focusRingClass(selected)}`}
        style={positionStyle}
        aria-label={`${ariaLabel} signature field (read-only)`}
      >
        <span className="sr-only">Signature</span>
      </div>
    );
  }

  if (overlay.kind === "UNKNOWN") {
    return null;
  }

  if (value.kind !== overlay.kind) {
    return null;
  }

  switch (value.kind) {
    case "TEXT": {
      const textAppearanceStyle = buildTextAppearanceStyle(
        descriptor,
        textFormat,
        value.value,
        pageDisplayHeightPx,
      );
      const commonProps = {
        "data-field-name": overlay.fieldName,
        disabled: isDisabled,
        value: value.value,
        onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          handleFocus();
          event.stopPropagation();
        },
        onChange: (
          event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
          onChange(
            setTextFieldValue(editState, overlay.fieldName, event.target.value),
            overlay.fieldName,
          );
        },
        "aria-invalid": Boolean(error),
        "aria-label": ariaLabel,
        "aria-required": overlay.required || undefined,
        title: error,
        className: `pointer-events-auto absolute resize-none rounded-sm border bg-transparent px-0.5 py-0 text-black outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? "border-red-400/80 bg-red-50/40"
            : selected
              ? "border-scanonix-orange/70 bg-white/50"
              : "border-transparent hover:border-scanonix-orange/30 hover:bg-white/20 focus:border-scanonix-orange/70 focus:bg-white/50"
        } ${focusRingClass(selected, Boolean(error))}`,
        style: {
          ...positionStyle,
          ...textAppearanceStyle,
        },
      };

      if (descriptor.multiline) {
        return <textarea {...commonProps} rows={2} maxLength={descriptor.maxLength} />;
      }

      return (
        <input
          {...commonProps}
          type="text"
          maxLength={descriptor.maxLength}
        />
      );
    }

    case "CHECKBOX": {
      const exportValue = overlay.widgetExportValue ?? overlay.widgetOptionValue;
      const usesDistinctWidgets = hasDistinctWidgetChoices(descriptor);
      const isChecked = usesDistinctWidgets
        ? Boolean(
            value.checked &&
              exportValue &&
              (value.selectedExportValue ?? null) === exportValue,
          )
        : overlay.widgetIndex === 0 && value.checked;

      if (usesDistinctWidgets && !exportValue) {
        return null;
      }

      if (!usesDistinctWidgets && overlay.widgetIndex > 0) {
        return null;
      }

      return (
        <label
          data-field-name={overlay.fieldName}
          className={`pointer-events-auto absolute flex cursor-pointer items-center justify-center ${focusRingClass(selected, Boolean(error))} ${
            isDisabled ? "cursor-not-allowed opacity-60" : ""
          }`}
          style={positionStyle}
        >
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isDisabled}
            aria-label={ariaLabel}
            aria-invalid={Boolean(error)}
            title={error}
            className="h-full max-h-5 w-full max-w-5 accent-scanonix-orange"
            onFocus={handleFocus}
            onChange={(event) => {
              if (usesDistinctWidgets && exportValue) {
                onChange(
                  setCheckboxFieldValue(
                    editState,
                    overlay.fieldName,
                    event.target.checked,
                    event.target.checked ? exportValue : null,
                  ),
                  overlay.fieldName,
                );
                return;
              }

              onChange(
                setCheckboxFieldValue(
                  editState,
                  overlay.fieldName,
                  event.target.checked,
                ),
                overlay.fieldName,
              );
            }}
          />
        </label>
      );
    }

    case "RADIO": {
      const optionValue = overlay.widgetOptionValue ?? overlay.widgetExportValue;
      if (!optionValue) {
        return null;
      }

      return (
        <label
          data-field-name={overlay.fieldName}
          className={`pointer-events-auto absolute flex cursor-pointer items-center justify-center ${focusRingClass(selected, Boolean(error))} ${
            isDisabled ? "cursor-not-allowed opacity-60" : ""
          }`}
          style={positionStyle}
        >
          <input
            type="radio"
            name={overlay.fieldName}
            value={optionValue}
            checked={value.selected === optionValue}
            disabled={isDisabled}
            aria-label={ariaLabel}
            aria-invalid={Boolean(error)}
            title={error}
            className="h-full max-h-5 w-full max-w-5 accent-scanonix-orange"
            onFocus={handleFocus}
            onChange={() => {
              onChange(
                setRadioFieldValue(editState, overlay.fieldName, optionValue),
                overlay.fieldName,
              );
            }}
          />
        </label>
      );
    }

    case "DROPDOWN":
      if (overlay.widgetIndex > 0) {
        return null;
      }

      return (
        <select
          data-field-name={overlay.fieldName}
          value={value.selected ?? ""}
          disabled={isDisabled}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          aria-required={overlay.required || undefined}
          title={error}
          onFocus={handleFocus}
          onChange={(event) => {
            onChange(
              setDropdownFieldValue(
                editState,
                overlay.fieldName,
                event.target.value || null,
              ),
              overlay.fieldName,
            );
          }}
          className={`pointer-events-auto absolute rounded-sm border bg-white/40 px-0.5 text-[11px] text-black outline-none transition backdrop-blur-[1px] disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? "border-red-400 bg-red-50/40"
              : selected
                ? "border-scanonix-orange/70 bg-white/60"
                : "border-transparent hover:border-scanonix-orange/30 hover:bg-white/30 focus:border-scanonix-orange/70 focus:bg-white/60"
          } ${focusRingClass(selected, Boolean(error))}`}
          style={positionStyle}
        >
          <option value="">Select…</option>
          {(descriptor.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "OPTION_LIST":
      if (overlay.widgetIndex > 0) {
        return null;
      }

      return (
        <select
          data-field-name={overlay.fieldName}
          multiple
          value={value.selected}
          disabled={isDisabled}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          title={error}
          onFocus={handleFocus}
          onChange={(event) => {
            const nextSelected = Array.from(event.target.selectedOptions).map(
              (option) => option.value,
            );
            onChange(
              setOptionListFieldValue(editState, overlay.fieldName, nextSelected),
              overlay.fieldName,
            );
          }}
          className={`pointer-events-auto absolute rounded-sm border bg-white/40 px-0.5 text-[11px] text-black outline-none transition backdrop-blur-[1px] disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? "border-red-400 bg-red-50/40"
              : selected
                ? "border-scanonix-orange/70 bg-white/60"
                : "border-transparent hover:border-scanonix-orange/30 hover:bg-white/30 focus:border-scanonix-orange/70 focus:bg-white/60"
          } ${focusRingClass(selected, Boolean(error))}`}
          style={positionStyle}
        >
          {(descriptor.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    default:
      return null;
  }
}
