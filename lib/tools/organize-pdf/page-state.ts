import type {
  OrganizeDocumentState,
  OrganizePageEntry,
  OrganizePageRotation,
} from "./types";
import { OrganizePdfError } from "./types";
import {
  nextRotationClockwise,
  nextRotationCounterClockwise,
} from "./rotation";

export function canExportOrganizePdf(state: OrganizeDocumentState): boolean {
  return state.pages.length > 0;
}

export function findPageIndexById(
  pages: OrganizePageEntry[],
  id: string,
): number {
  return pages.findIndex((page) => page.id === id);
}

export function getPageById(
  pages: OrganizePageEntry[],
  id: string,
): OrganizePageEntry {
  const page = pages.find((entry) => entry.id === id);
  if (!page) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }
  return page;
}

/** Move page from one array index to another (immutable). */
export function reorderPages(
  pages: OrganizePageEntry[],
  fromIndex: number,
  toIndex: number,
): OrganizePageEntry[] {
  if (fromIndex === toIndex) {
    return pages;
  }

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= pages.length ||
    toIndex >= pages.length
  ) {
    throw new OrganizePdfError(
      "INVALID_INDEX",
      "Page reorder indices are outside the document range.",
    );
  }

  const next = [...pages];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function reorderPageById(
  pages: OrganizePageEntry[],
  id: string,
  toIndex: number,
): OrganizePageEntry[] {
  const fromIndex = findPageIndexById(pages, id);
  if (fromIndex === -1) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }
  return reorderPages(pages, fromIndex, toIndex);
}

export function movePageLeft(pages: OrganizePageEntry[], id: string): OrganizePageEntry[] {
  const index = findPageIndexById(pages, id);
  if (index === -1) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }
  if (index === 0) {
    return pages;
  }
  return reorderPages(pages, index, index - 1);
}

export function movePageRight(pages: OrganizePageEntry[], id: string): OrganizePageEntry[] {
  const index = findPageIndexById(pages, id);
  if (index === -1) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }
  if (index >= pages.length - 1) {
    return pages;
  }
  return reorderPages(pages, index, index + 1);
}

function rotateEntryDelta(
  entry: OrganizePageEntry,
  direction: "clockwise" | "counterclockwise",
): OrganizePageEntry {
  const rotationDelta: OrganizePageRotation =
    direction === "clockwise"
      ? nextRotationClockwise(entry.rotationDelta)
      : nextRotationCounterClockwise(entry.rotationDelta);

  return { ...entry, rotationDelta };
}

export function rotatePageById(
  pages: OrganizePageEntry[],
  id: string,
  direction: "clockwise" | "counterclockwise" = "clockwise",
): OrganizePageEntry[] {
  const index = findPageIndexById(pages, id);
  if (index === -1) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }

  return pages.map((entry, entryIndex) =>
    entryIndex === index ? rotateEntryDelta(entry, direction) : entry,
  );
}

export function deletePageById(
  pages: OrganizePageEntry[],
  id: string,
): OrganizePageEntry[] {
  const index = findPageIndexById(pages, id);
  if (index === -1) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }

  if (pages.length <= 1) {
    throw new OrganizePdfError(
      "CANNOT_DELETE_LAST_PAGE",
      "Cannot delete the last remaining page.",
    );
  }

  return pages.filter((entry) => entry.id !== id);
}

export function deletePageAtIndex(
  pages: OrganizePageEntry[],
  index: number,
): OrganizePageEntry[] {
  if (index < 0 || index >= pages.length) {
    throw new OrganizePdfError(
      "INVALID_INDEX",
      "Page index is outside the document range.",
    );
  }

  const id = pages[index]?.id;
  if (!id) {
    throw new OrganizePdfError("PAGE_NOT_FOUND", "Page not found in document.");
  }

  return deletePageById(pages, id);
}

export function withPages(
  state: OrganizeDocumentState,
  pages: OrganizePageEntry[],
): OrganizeDocumentState {
  return { pages };
}
