/**
 * Organize PDF UI helper tests (Phase 120C).
 * Run: npx tsx scripts/verify-organize-pdf-ui-helpers.ts
 */

import {
  deletePageById,
  movePageLeft,
  movePageRight,
  reorderPages,
  rotatePageById,
  type OrganizePageEntry,
} from "../lib/tools/organize-pdf";
import {
  canDeletePage,
  canExportOrganizeWorkspace,
  canMovePageFirst,
  canMovePageEarlier,
  canMovePageLater,
  canMovePageLast,
  countRotatedPages,
  getDeletedPageCount,
  getDisplayPageNumber,
  getWorkspaceSummary,
  movePageFirst,
  movePageLast,
} from "../lib/tools/organize-pdf/workspace-ui";
import { OrganizePdfError } from "../lib/tools/organize-pdf/types";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function page(id: string, sourcePageIndex: number): OrganizePageEntry {
  return {
    id,
    sourcePageIndex,
    intrinsicRotation: 0,
    rotationDelta: 0,
    mediaWidth: 400,
    mediaHeight: 600,
  };
}

function run() {
  console.log("\nOrganize PDF UI helper verification\n");

  assert("display page number", getDisplayPageNumber(2) === 3);
  assert("move first enabled for index 1", canMovePageFirst(1));
  assert("move first disabled for index 0", !canMovePageFirst(0));
  assert("move earlier enabled for index 1", canMovePageEarlier(1));
  assert("move earlier disabled for index 0", !canMovePageEarlier(0));
  assert("move later enabled for first of two", canMovePageLater(0, 2));
  assert("move later disabled for last", !canMovePageLater(1, 2));
  assert("move last enabled for first of four", canMovePageLast(0, 4));
  assert("move last disabled for last", !canMovePageLast(3, 4));
  assert("delete allowed with multiple pages", canDeletePage(2));
  assert("delete blocked with one page", !canDeletePage(1));
  assert(
    "export disabled while processing",
    !canExportOrganizeWorkspace(3, true),
  );
  assert("export enabled with pages", canExportOrganizeWorkspace(3, false));

  const pages = [page("a", 0), page("b", 1), page("c", 2)];
  const movedLeft = movePageLeft(pages, "b");
  assert(
    "move earlier changes order",
    movedLeft.map((entry) => entry.id).join(",") === "b,a,c",
  );

  const movedRight = movePageRight(pages, "b");
  assert(
    "move later changes order",
    movedRight.map((entry) => entry.id).join(",") === "a,c,b",
  );

  assert(
    "move earlier on first page is no-op",
    movePageLeft(pages, "a").map((entry) => entry.id).join(",") === "a,b,c",
  );

  assert(
    "move later on last page is no-op",
    movePageRight(pages, "c").map((entry) => entry.id).join(",") === "a,b,c",
  );

  const fourPages = [
    page("a", 0),
    page("b", 1),
    page("c", 2),
    page("d", 3),
  ];

  assert(
    "move first changes order",
    movePageFirst(fourPages, "d").map((entry) => entry.id).join(",") === "d,a,b,c",
  );

  assert(
    "move last changes order",
    movePageLast(fourPages, "a").map((entry) => entry.id).join(",") === "b,c,d,a",
  );

  assert(
    "move first on first page is no-op",
    movePageFirst(fourPages, "a").map((entry) => entry.id).join(",") === "a,b,c,d",
  );

  assert(
    "move last on last page is no-op",
    movePageLast(fourPages, "d").map((entry) => entry.id).join(",") === "a,b,c,d",
  );

  const rotated = rotatePageById(pages, "b");
  assert(
    "rotate button updates state",
    rotated.find((entry) => entry.id === "b")?.rotationDelta === 90,
  );

  assert("deleted count", getDeletedPageCount(4, 2) === 2);

  const summary = getWorkspaceSummary(
    rotatePageById(pages, "a"),
    3,
  );
  assert("workspace summary current pages", summary.currentPages === 3);
  assert("workspace summary rotated count", summary.rotatedCount === 1);

  assert(
    "reorder preserves ids",
    reorderPages(pages, 2, 0).map((entry) => entry.id).join(",") === "c,a,b",
  );

  let deleteBlocked = false;
  try {
    deletePageById([page("solo", 0)], "solo");
  } catch (error) {
    deleteBlocked =
      error instanceof OrganizePdfError &&
      error.code === "CANNOT_DELETE_LAST_PAGE";
  }
  assert("final page delete blocked", deleteBlocked);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
