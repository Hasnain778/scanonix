export type BackgroundRemoverProgressPhase =
  | "preparing"
  | "loading-model"
  | "removing-background"
  | "finalising"
  | "complete";

export type BackgroundRemoverErrorCode =
  | "UNSUPPORTED"
  | "TOO_LARGE"
  | "NO_SUBJECT"
  | "FAILURE";

export class BackgroundRemoverError extends Error {
  readonly code: BackgroundRemoverErrorCode;

  constructor(code: BackgroundRemoverErrorCode, message: string) {
    super(message);
    this.name = "BackgroundRemoverError";
    this.code = code;
  }
}

export type BackgroundPreviewMode = "transparent" | "white" | "black" | "custom";

export type BackgroundRemoverProgressCallback = (
  phase: BackgroundRemoverProgressPhase,
  detail?: { current?: number; total?: number; message?: string },
) => void;

export function getBackgroundRemoverProgressMessage(
  phase: BackgroundRemoverProgressPhase,
  detail?: { current?: number; total?: number; message?: string },
): string {
  switch (phase) {
    case "preparing":
      return "Preparing image…";
    case "loading-model":
      if (detail?.current !== undefined && detail.total) {
        return `Loading model… ${Math.round((detail.current / detail.total) * 100)}%`;
      }
      return "Loading model…";
    case "removing-background":
      return "Removing background…";
    case "finalising":
      return "Finalising…";
    case "complete":
      return "Complete";
  }
}
