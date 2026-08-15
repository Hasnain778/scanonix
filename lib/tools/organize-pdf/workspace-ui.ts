import { findPageIndexById, reorderPageById } from "./page-state";
import type { OrganizePageEntry } from "./types";

/** 1-based display position shown on page cards. */
export function getDisplayPageNumber(index: number): number {
  return index + 1;
}

export function canMovePageFirst(index: number): boolean {
  return index > 0;
}

export function canMovePageEarlier(index: number): boolean {
  return index > 0;
}

export function canMovePageLater(index: number, pageCount: number): boolean {
  return index < pageCount - 1;
}

export function canMovePageLast(index: number, pageCount: number): boolean {
  return index < pageCount - 1;
}

/** Move page to index 0 using the existing reorder engine. */
export function movePageFirst(
  pages: OrganizePageEntry[],
  id: string,
): OrganizePageEntry[] {
  const index = findPageIndexById(pages, id);
  if (index <= 0) {
    return pages;
  }
  return reorderPageById(pages, id, 0);
}

/** Move page to the final index using the existing reorder engine. */
export function movePageLast(
  pages: OrganizePageEntry[],
  id: string,
): OrganizePageEntry[] {
  const index = findPageIndexById(pages, id);
  if (index === -1 || index >= pages.length - 1) {
    return pages;
  }
  return reorderPageById(pages, id, pages.length - 1);
}

export function canDeletePage(pageCount: number): boolean {
  return pageCount > 1;
}

export function canExportOrganizeWorkspace(
  pageCount: number,
  isExporting: boolean,
): boolean {
  return pageCount > 0 && !isExporting;
}

export function countRotatedPages(pages: OrganizePageEntry[]): number {
  return pages.filter((page) => page.rotationDelta !== 0).length;
}

export function getDeletedPageCount(
  initialPageCount: number,
  currentPageCount: number,
): number {
  return Math.max(0, initialPageCount - currentPageCount);
}

export interface OrganizeWorkspaceSummary {
  currentPages: number;
  deletedCount: number;
  rotatedCount: number;
}

export function getWorkspaceSummary(
  pages: OrganizePageEntry[],
  initialPageCount: number,
): OrganizeWorkspaceSummary {
  return {
    currentPages: pages.length,
    deletedCount: getDeletedPageCount(initialPageCount, pages.length),
    rotatedCount: countRotatedPages(pages),
  };
}

/** Stable signature for thumbnail reload when rotation/source changes. */
export function getPageThumbnailSignature(page: OrganizePageEntry): string {
  return `${page.id}:${page.sourcePageIndex}:${page.intrinsicRotation}:${page.rotationDelta}`;
}
