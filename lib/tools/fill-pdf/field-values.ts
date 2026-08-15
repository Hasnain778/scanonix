import type { FormEditState, FormFieldDescriptor, FormFieldValue } from "./types";

export function createInitialFormState(
  descriptors: FormFieldDescriptor[],
): FormEditState {
  const state: FormEditState = {};

  for (const descriptor of descriptors) {
    state[descriptor.name] = cloneFieldValue(descriptor.currentValue);
  }

  return state;
}

export function resetToOriginalValues(initialSnapshot: FormEditState): FormEditState {
  const reset: FormEditState = {};

  for (const [name, value] of Object.entries(initialSnapshot)) {
    reset[name] = cloneFieldValue(value);
  }

  return reset;
}

export function cloneFieldValue(value: FormFieldValue): FormFieldValue {
  switch (value.kind) {
    case "OPTION_LIST":
      return { kind: "OPTION_LIST", selected: [...value.selected] };
    default:
      return { ...value };
  }
}

export function setTextFieldValue(
  state: FormEditState,
  fieldName: string,
  value: string,
): FormEditState {
  return {
    ...state,
    [fieldName]: { kind: "TEXT", value },
  };
}

export function setCheckboxFieldValue(
  state: FormEditState,
  fieldName: string,
  checked: boolean,
  selectedExportValue?: string | null,
): FormEditState {
  const nextValue: FormFieldValue = { kind: "CHECKBOX", checked };

  if (selectedExportValue !== undefined) {
    nextValue.selectedExportValue = selectedExportValue;
  } else if (!checked) {
    nextValue.selectedExportValue = null;
  }

  return {
    ...state,
    [fieldName]: nextValue,
  };
}

export function setRadioFieldValue(
  state: FormEditState,
  fieldName: string,
  selected: string | null,
): FormEditState {
  return {
    ...state,
    [fieldName]: { kind: "RADIO", selected },
  };
}

export function setDropdownFieldValue(
  state: FormEditState,
  fieldName: string,
  selected: string | null,
): FormEditState {
  return {
    ...state,
    [fieldName]: { kind: "DROPDOWN", selected },
  };
}

export function setOptionListFieldValue(
  state: FormEditState,
  fieldName: string,
  selected: string[],
): FormEditState {
  return {
    ...state,
    [fieldName]: { kind: "OPTION_LIST", selected: [...selected] },
  };
}

export function fieldValuesEqual(
  left: FormFieldValue,
  right: FormFieldValue,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "TEXT":
      return right.kind === "TEXT" && left.value === right.value;
    case "CHECKBOX":
      return (
        right.kind === "CHECKBOX" &&
        left.checked === right.checked &&
        (left.selectedExportValue ?? null) === (right.selectedExportValue ?? null)
      );
    case "RADIO":
      return right.kind === "RADIO" && left.selected === right.selected;
    case "DROPDOWN":
      return right.kind === "DROPDOWN" && left.selected === right.selected;
    case "OPTION_LIST":
      return (
        right.kind === "OPTION_LIST" &&
        left.selected.length === right.selected.length &&
        left.selected.every((value, index) => value === right.selected[index])
      );
    default:
      return true;
  }
}

export function getEditedFieldNames(
  initialValues: FormEditState,
  currentValues: FormEditState,
): string[] {
  return Object.keys(currentValues).filter((name) => {
    const initial = initialValues[name];
    const current = currentValues[name];
    if (!initial || !current) {
      return false;
    }
    return !fieldValuesEqual(initial, current);
  });
}
