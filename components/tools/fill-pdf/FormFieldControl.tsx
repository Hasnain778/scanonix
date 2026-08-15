"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import {
  formatChoiceOptionLabel,
  getCheckboxChoiceLabel,
  getFieldDisplayLabel,
} from "@/lib/tools/fill-pdf";
import type { FormFieldDescriptor, FormFieldValue } from "@/lib/tools/fill-pdf/types";
import {
  setCheckboxFieldValue,
  setDropdownFieldValue,
  setOptionListFieldValue,
  setRadioFieldValue,
  setTextFieldValue,
} from "@/lib/tools/fill-pdf/field-values";
import type { FormEditState } from "@/lib/tools/fill-pdf/types";

interface FormFieldControlProps {
  descriptor: FormFieldDescriptor;
  value: FormFieldValue;
  disabled?: boolean;
  error?: string;
  onChange: (nextState: FormEditState, fieldName: string) => void;
  onSelect?: (fieldName: string) => void;
  editState: FormEditState;
  presentation?: "standalone" | "grouped-option";
}

function FieldMeta({
  descriptor,
  error,
}: {
  descriptor: FormFieldDescriptor;
  error?: string;
}) {
  return (
    <div className="mb-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-white">
          {getFieldDisplayLabel(descriptor)}
        </span>
        {descriptor.required && (
          <span className="rounded-full bg-scanonix-orange/15 px-2 py-0.5 text-xs text-scanonix-orange">
            Required
          </span>
        )}
        {descriptor.readOnly && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-scanonix-muted">
            Read-only
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function FormFieldControl({
  descriptor,
  value,
  disabled = false,
  error,
  onChange,
  onSelect,
  editState,
  presentation = "standalone",
}: FormFieldControlProps) {
  const isDisabled = disabled || descriptor.readOnly;
  const handleFocus = () => onSelect?.(descriptor.name);
  const isGroupedOption = presentation === "grouped-option";

  if (descriptor.kind === "BUTTON") {
    return (
      <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
        <FieldMeta descriptor={descriptor} />
        <p className="text-sm text-scanonix-muted">
          Button fields cannot be filled here.
        </p>
      </div>
    );
  }

  if (descriptor.kind === "SIGNATURE") {
    return (
      <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
        <FieldMeta descriptor={descriptor} />
        <p className="text-sm text-scanonix-muted">
          Digital signature field — not editable here.{" "}
          <Link
            href="/tools/sign-pdf"
            className="text-scanonix-orange underline-offset-2 hover:underline"
          >
            Sign PDF instead
          </Link>
          .
        </p>
      </div>
    );
  }

  if (descriptor.kind === "UNKNOWN") {
    return (
      <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
        <FieldMeta descriptor={descriptor} />
        <p className="text-sm text-scanonix-muted">
          This field type is not supported for filling.
        </p>
      </div>
    );
  }

  if (value.kind !== descriptor.kind) {
    return (
      <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
        <FieldMeta descriptor={descriptor} error={error ?? "Invalid field value."} />
      </div>
    );
  }

  switch (value.kind) {
    case "TEXT": {
      const commonProps = {
        disabled: isDisabled,
        value: value.value,
        onFocus: handleFocus,
        onChange: (
          event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
          onChange(
            setTextFieldValue(editState, descriptor.name, event.target.value),
            descriptor.name,
          );
        },
        className:
          "w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-sm text-white placeholder:text-scanonix-muted/70 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20 disabled:cursor-not-allowed disabled:opacity-60",
      };

      return (
        <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
          <FieldMeta descriptor={descriptor} error={error} />
          {descriptor.multiline ? (
            <textarea
              {...commonProps}
              rows={4}
              maxLength={descriptor.maxLength}
              aria-invalid={Boolean(error)}
            />
          ) : (
            <input
              {...commonProps}
              type="text"
              maxLength={descriptor.maxLength}
              aria-invalid={Boolean(error)}
            />
          )}
          {descriptor.maxLength !== undefined && (
            <p className="mt-2 text-xs text-scanonix-muted">
              {value.value.length}/{descriptor.maxLength} characters
            </p>
          )}
        </div>
      );
    }

    case "CHECKBOX": {
      const choiceLabel = getCheckboxChoiceLabel(descriptor);

      if (isGroupedOption) {
        return (
          <label className="flex items-center gap-3 text-sm text-scanonix-muted">
            <input
              type="checkbox"
              checked={value.checked}
              disabled={isDisabled}
              aria-invalid={Boolean(error)}
              onFocus={handleFocus}
              onChange={(event) => {
                onChange(
                  setCheckboxFieldValue(
                    editState,
                    descriptor.name,
                    event.target.checked,
                  ),
                  descriptor.name,
                );
              }}
              className="h-4 w-4 accent-scanonix-orange"
            />
            {choiceLabel}
          </label>
        );
      }

      return (
        <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
          <FieldMeta descriptor={descriptor} error={error} />
          <label className="flex items-center gap-3 text-sm text-scanonix-muted">
            <input
              type="checkbox"
              checked={value.checked}
              disabled={isDisabled}
              aria-invalid={Boolean(error)}
              onFocus={handleFocus}
              onChange={(event) => {
                onChange(
                  setCheckboxFieldValue(
                    editState,
                    descriptor.name,
                    event.target.checked,
                  ),
                  descriptor.name,
                );
              }}
              className="h-4 w-4 accent-scanonix-orange"
            />
            {choiceLabel}
          </label>
        </div>
      );
    }

    case "RADIO":
      return (
        <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
          <FieldMeta descriptor={descriptor} error={error} />
          <fieldset className="space-y-2">
            <legend className="sr-only">{getFieldDisplayLabel(descriptor)}</legend>
            {(descriptor.options ?? []).map((option) => (
              <label
                key={option}
                className="flex items-center gap-3 text-sm text-scanonix-muted"
              >
                <input
                  type="radio"
                  name={descriptor.name}
                  value={option}
                  checked={value.selected === option}
                  disabled={isDisabled}
                  onFocus={handleFocus}
                  onChange={() => {
                    onChange(
                      setRadioFieldValue(editState, descriptor.name, option),
                      descriptor.name,
                    );
                  }}
                  className="h-4 w-4 accent-scanonix-orange"
                />
                {formatChoiceOptionLabel(option)}
              </label>
            ))}
          </fieldset>
        </div>
      );

    case "DROPDOWN":
      return (
        <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
          <FieldMeta descriptor={descriptor} error={error} />
          <select
            value={value.selected ?? ""}
            disabled={isDisabled}
            aria-invalid={Boolean(error)}
            onFocus={handleFocus}
            onChange={(event) => {
              onChange(
                setDropdownFieldValue(
                  editState,
                  descriptor.name,
                  event.target.value || null,
                ),
                descriptor.name,
              );
            }}
            className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Select an option</option>
            {(descriptor.options ?? []).map((option) => (
              <option key={option} value={option}>
                {formatChoiceOptionLabel(option)}
              </option>
            ))}
          </select>
        </div>
      );

    case "OPTION_LIST":
      return (
        <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
          <FieldMeta descriptor={descriptor} error={error} />
          <fieldset className="space-y-2">
            <legend className="sr-only">{getFieldDisplayLabel(descriptor)}</legend>
            {(descriptor.options ?? []).map((option) => {
              const checked = value.selected.includes(option);
              return (
                <label
                  key={option}
                  className="flex items-center gap-3 text-sm text-scanonix-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDisabled}
                    aria-invalid={Boolean(error)}
                    onFocus={handleFocus}
                    onChange={(event) => {
                      const nextSelected = event.target.checked
                        ? [...value.selected, option]
                        : value.selected.filter((item) => item !== option);
                      onChange(
                        setOptionListFieldValue(
                          editState,
                          descriptor.name,
                          nextSelected,
                        ),
                        descriptor.name,
                      );
                    }}
                    className="h-4 w-4 accent-scanonix-orange"
                  />
                  {formatChoiceOptionLabel(option)}
                </label>
              );
            })}
          </fieldset>
        </div>
      );

    default:
      return null;
  }
}
