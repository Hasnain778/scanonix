/** Organize PDF core types — stable page identity + export state (Phase 120B). */

export type OrganizePageRotation = 0 | 90 | 180 | 270;

/**
 * One logical page in the working document.
 *
 * Array order in OrganizeDocumentState.pages is the current UI/export order.
 * Identity is always `id`, never array index.
 */
export interface OrganizePageEntry {
  /** Stable UUID — never derived from array index. */
  id: string;
  /** 0-based index in the uploaded source PDF (immutable after load). */
  sourcePageIndex: number;
  /**
   * Rotation read from the source PDF at load time (pdf-lib page.getRotation().angle).
   * Preserved so user deltas stack on existing document rotation metadata.
   */
  intrinsicRotation: OrganizePageRotation;
  /**
   * User-applied rotation delta (clockwise steps of 90°).
   * Final export rotation = normalize(intrinsicRotation + rotationDelta).
   */
  rotationDelta: OrganizePageRotation;
  /** Media box width in PDF points (from pdf-lib page.getSize().width). */
  mediaWidth: number;
  /** Media box height in PDF points (from pdf-lib page.getSize().height). */
  mediaHeight: number;
}

export interface OrganizeDocumentState {
  pages: OrganizePageEntry[];
}

export type OrganizePdfErrorCode =
  | "PASSWORD_PDF"
  | "CORRUPT_PDF"
  | "NO_PAGES"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "CANNOT_DELETE_LAST_PAGE"
  | "PAGE_NOT_FOUND"
  | "INVALID_INDEX"
  | "EXPORT_FAILED";

export class OrganizePdfError extends Error {
  readonly code: OrganizePdfErrorCode;

  constructor(code: OrganizePdfErrorCode, message: string) {
    super(message);
    this.name = "OrganizePdfError";
    this.code = code;
  }
}

export function getOrganizePdfErrorMessage(error: unknown): string {
  if (error instanceof OrganizePdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not organize this PDF. The file may be corrupt or unsupported.";
}
