/**
 * Pure helpers for Background Remover preview URL state (Phase 7J).
 */

export interface BackgroundRemoverPreviewState {
  originalPreviewUrl: string | null;
  processedPreviewUrl: string | null;
}

export function createPreviewStateFromSuccess(
  originalPreviewUrl: string,
  processedPreviewUrl: string,
): BackgroundRemoverPreviewState {
  if (originalPreviewUrl === processedPreviewUrl) {
    throw new Error("Original and processed preview URLs must be distinct.");
  }

  return {
    originalPreviewUrl,
    processedPreviewUrl,
  };
}

export function clearPreviewState(): BackgroundRemoverPreviewState {
  return {
    originalPreviewUrl: null,
    processedPreviewUrl: null,
  };
}

export function hasCompletePreviewState(
  state: BackgroundRemoverPreviewState,
): boolean {
  return Boolean(state.originalPreviewUrl && state.processedPreviewUrl);
}

export function selectBeforeAfterUrls(state: BackgroundRemoverPreviewState): {
  beforeUrl: string | null;
  afterUrl: string | null;
} {
  return {
    beforeUrl: state.originalPreviewUrl,
    afterUrl: state.processedPreviewUrl,
  };
}
