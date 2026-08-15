"use client";

import { useEffect, useMemo, useRef } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  buildFieldPresentationEntries,
  computeWorkspaceFieldProgress,
  getFieldDisplayLabel,
  getFieldGroupReadOnlyState,
  getFieldGroupRequiredState,
  getFieldPageLabel,
  getNextMissingRequiredFieldName,
  getWidgetChoiceLabel,
  isFieldComplete,
  type FillPdfWorkspaceState,
} from "@/lib/tools/fill-pdf";
import type { FormEditState, FormFieldDescriptor } from "@/lib/tools/fill-pdf/types";
import { setCheckboxFieldValue } from "@/lib/tools/fill-pdf/field-values";
import { FormFieldControl } from "./FormFieldControl";

interface FormFieldPanelProps {
  fields: FormFieldDescriptor[];
  workspace: FillPdfWorkspaceState;
  disabled?: boolean;
  onFieldChange: (nextState: FormEditState, fieldName: string) => void;
  onFieldSelect: (fieldName: string) => void;
  onReset: () => void;
}

function CompletionBadge({
  complete,
  required,
}: {
  complete: boolean;
  required: boolean;
}) {
  if (complete) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
        Done
      </span>
    );
  }

  if (required) {
    return (
      <span className="rounded-full bg-scanonix-orange/15 px-2 py-0.5 text-xs text-scanonix-orange">
        Required
      </span>
    );
  }

  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-scanonix-muted">
      Empty
    </span>
  );
}

export function FormFieldPanel({
  fields,
  workspace,
  disabled = false,
  onFieldChange,
  onFieldSelect,
  onReset,
}: FormFieldPanelProps) {
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());
  const presentationEntries = useMemo(
    () => buildFieldPresentationEntries(fields),
    [fields],
  );
  const progress = useMemo(
    () => computeWorkspaceFieldProgress(fields, workspace.editState),
    [fields, workspace.editState],
  );

  useEffect(() => {
    if (!workspace.selectedFieldName) {
      return;
    }

    const node = itemRefs.current.get(workspace.selectedFieldName);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [workspace.selectedFieldName]);

  const handleReviewMissing = () => {
    const nextRequired = getNextMissingRequiredFieldName(
      fields,
      workspace.editState,
      workspace.selectedFieldName,
    );
    if (nextRequired) {
      onFieldSelect(nextRequired);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Field overview</h2>
          <p className="mt-1 text-sm text-scanonix-muted">
            {progress.completed} of {progress.totalEditable} fields completed
            {progress.requiredRemaining > 0
              ? ` · ${progress.requiredRemaining} required remaining`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {progress.requiredRemaining > 0 && (
            <ActionButton
              variant="outline"
              size="sm"
              disabled={
                disabled ||
                !getNextMissingRequiredFieldName(
                  fields,
                  workspace.editState,
                  workspace.selectedFieldName,
                )
              }
              onClick={handleReviewMissing}
            >
              Review missing
            </ActionButton>
          )}
          <ActionButton
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={disabled}
            onClick={onReset}
          >
            Reset form
          </ActionButton>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {presentationEntries.map((entry) => {
          if (entry.kind === "checkbox-group") {
            const selected = entry.members.some(
              (member) => workspace.selectedFieldName === member.name,
            );
            const groupError = entry.members
              .map((member) => workspace.fieldErrors[member.name])
              .find(Boolean);
            const required = getFieldGroupRequiredState(entry.members);
            const readOnly = getFieldGroupReadOnlyState(entry.members);
            const groupComplete = entry.members.every((member) =>
              isFieldComplete(member, workspace.editState[member.name]),
            );
            const focusName = entry.members[0]?.name ?? entry.groupKey;

            return (
              <div
                key={entry.groupKey}
                ref={(node) => {
                  for (const member of entry.members) {
                    itemRefs.current.set(member.name, node);
                  }
                }}
                data-field-group={entry.groupKey}
                className={`rounded-2xl transition ${
                  selected ? "ring-2 ring-scanonix-orange/40" : ""
                }`}
              >
                <button
                  type="button"
                  className="w-full rounded-xl border border-scanonix-border bg-black/20 p-4 text-left"
                  onClick={() => onFieldSelect(focusName)}
                >
                  <div className="mb-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {entry.groupLabel}
                      </span>
                      <CompletionBadge complete={groupComplete} required={required} />
                      {readOnly && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-scanonix-muted">
                          Read-only
                        </span>
                      )}
                    </div>
                    {groupError && (
                      <p className="text-xs text-red-300">{groupError}</p>
                    )}
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="sr-only">{entry.groupLabel}</legend>
                    {entry.members.map((descriptor) => {
                      const value = workspace.editState[descriptor.name];
                      if (!value) {
                        return null;
                      }

                      return (
                        <FormFieldControl
                          key={descriptor.name}
                          descriptor={descriptor}
                          value={value}
                          editState={workspace.editState}
                          disabled={disabled}
                          error={workspace.fieldErrors[descriptor.name]}
                          presentation="grouped-option"
                          onChange={onFieldChange}
                          onSelect={onFieldSelect}
                        />
                      );
                    })}
                  </fieldset>
                </button>
              </div>
            );
          }

          if (entry.kind === "widget-checkbox-group") {
            const descriptor = entry.descriptor;
            const value = workspace.editState[descriptor.name];
            const selected = workspace.selectedFieldName === descriptor.name;
            const error = workspace.fieldErrors[descriptor.name];
            const choiceWidgets = descriptor.widgets.filter(
              (widget) => widget.widgetExportValue,
            );

            if (!value || value.kind !== "CHECKBOX") {
              return null;
            }

            return (
              <div
                key={entry.groupKey}
                ref={(node) => {
                  itemRefs.current.set(descriptor.name, node);
                }}
                data-field-group={entry.groupKey}
                className={`rounded-2xl transition ${
                  selected ? "ring-2 ring-scanonix-orange/40" : ""
                }`}
              >
                <button
                  type="button"
                  className="w-full rounded-xl border border-scanonix-border bg-black/20 p-4 text-left"
                  onClick={() => onFieldSelect(descriptor.name)}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {entry.groupLabel}
                    </span>
                    <CompletionBadge
                      complete={isFieldComplete(descriptor, value)}
                      required={descriptor.required}
                    />
                    <span className="text-xs text-scanonix-muted">
                      Page {getFieldPageLabel(fields, descriptor.name) ?? "?"}
                    </span>
                  </div>
                  {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
                  <fieldset className="space-y-2">
                    <legend className="sr-only">{entry.groupLabel}</legend>
                    {choiceWidgets.map((widget) => {
                      const exportValue = widget.widgetExportValue!;
                      const checked =
                        value.checked &&
                        (value.selectedExportValue ?? null) === exportValue;

                      return (
                        <label
                          key={`${descriptor.name}-${widget.widgetIndex}`}
                          className="flex items-center gap-3 text-sm text-scanonix-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled || descriptor.readOnly}
                            onFocus={() => onFieldSelect(descriptor.name)}
                            onChange={(event) => {
                              onFieldChange(
                                setCheckboxFieldValue(
                                  workspace.editState,
                                  descriptor.name,
                                  event.target.checked,
                                  event.target.checked ? exportValue : null,
                                ),
                                descriptor.name,
                              );
                            }}
                            className="h-4 w-4 accent-scanonix-orange"
                          />
                          {getWidgetChoiceLabel(descriptor, widget)}
                        </label>
                      );
                    })}
                  </fieldset>
                </button>
              </div>
            );
          }

          const descriptor = entry.descriptor;
          const value = workspace.editState[descriptor.name];
          const selected = workspace.selectedFieldName === descriptor.name;
          const error = workspace.fieldErrors[descriptor.name];

          if (!value) {
            return null;
          }

          return (
            <div
              key={descriptor.name}
              ref={(node) => {
                itemRefs.current.set(descriptor.name, node);
              }}
              data-field-name={descriptor.name}
              className={`rounded-2xl transition ${
                selected ? "ring-2 ring-scanonix-orange/40" : ""
              }`}
            >
              <div className="rounded-xl border border-scanonix-border bg-black/20 p-4">
                <button
                  type="button"
                  className="mb-3 flex w-full flex-wrap items-center gap-2 text-left"
                  onClick={() => onFieldSelect(descriptor.name)}
                >
                  <span className="text-sm font-medium text-white">
                    {getFieldDisplayLabel(descriptor)}
                  </span>
                  <CompletionBadge
                    complete={isFieldComplete(descriptor, value)}
                    required={descriptor.required}
                  />
                  <span className="text-xs text-scanonix-muted">
                    Page {getFieldPageLabel(fields, descriptor.name) ?? "?"}
                  </span>
                </button>
                <FormFieldControl
                  descriptor={descriptor}
                  value={value}
                  editState={workspace.editState}
                  disabled={disabled}
                  error={error}
                  onChange={onFieldChange}
                  onSelect={onFieldSelect}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
