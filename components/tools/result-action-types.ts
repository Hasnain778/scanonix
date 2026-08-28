/**
 * Presentational phase contract for shared result-action UI.
 * Tools own real processing state; this is not a global store.
 */
export type ResultActionPhase =
  | "idle"
  | "ready"
  | "processing"
  | "success"
  | "error";

export type ResultAction = {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** When true, the action is omitted from the DOM (not merely visually hidden). */
  hidden?: boolean;
  ariaLabel?: string;
};
