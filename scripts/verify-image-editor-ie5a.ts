/**
 * IE-5A — Image Editor public release foundation verifier.
 * Run: npx tsx scripts/verify-image-editor-ie5a.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANONICAL_TOOL_IDS,
  getToolCategoryMeta,
  toolMatchesCategoryFilter,
} from "../constants/tool-categories";
import { HOMEPAGE_TOOLS, NAV_DROPDOWN_TOOLS } from "../constants/homepage-tools";
import { IMAGE_HUB_EDIT_TOOLS } from "../constants/image-tools";
import { INDEXABLE_TOOL_PATHS, TOOL_SEO } from "../constants/tool-seo";
import { SCANONIX_TOOLS, filterTools } from "../constants/tools-directory-data";
import { TOOL_VISUALS } from "../constants/tool-visuals";
import { getToolAccess } from "../lib/plan/tool-access";

const root = process.cwd();
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

function run() {
  console.log("\nImage Editor IE-5A public release verification\n");

  const publicPage = join(root, "app", "tools", "image-editor", "page.tsx");
  const devPage = join(root, "app", "dev", "image-editor", "page.tsx");
  const finder = readFileSync(
    join(root, "components", "tool-finder", "ToolFinderRoot.tsx"),
    "utf8",
  );
  const publicSource = readFileSync(publicPage, "utf8");
  const devSource = readFileSync(devPage, "utf8");

  assert("1 public route file exists", existsSync(publicPage));
  assert("2 public page uses createToolPageMetadata", publicSource.includes('createToolPageMetadata("image-editor")'));
  assert("3 public page does not set noindex", !publicSource.includes("index: false"));
  assert("4 public page renders ImageEditorWorkspace", publicSource.includes("ImageEditorWorkspace"));
  assert("5 public page uses ImageEditorPageFrame", publicSource.includes("ImageEditorPageFrame"));

  assert("6 dev route still exists", existsSync(devPage));
  assert("7 dev route remains noindex", devSource.includes("index: false"));
  assert("8 matrix contains image-editor once", CANONICAL_TOOL_IDS.filter((id) => id === "image-editor").length === 1);

  const meta = getToolCategoryMeta("image-editor");
  assert("9 category=image", meta?.primaryCategory === "image");
  assert("10 subcategory=edit-create", meta?.imageSubcategory === "edit-create");
  assert("11 displayOrder 239", meta?.displayOrder === 239);

  const access = getToolAccess("image-editor");
  assert(
    "12 FREE_CLIENT access",
    access?.requiresAuth === false &&
      access?.requiresPro === false &&
      access?.processing === "client" &&
      access?.route === "image-editor",
  );

  assert("13 homepage tools entry present", HOMEPAGE_TOOLS.some((t) => t.id === "image-editor" && t.href === "/tools/image-editor"));
  assert("14 TOOL_SEO path canonical", TOOL_SEO["image-editor"]?.path === "/tools/image-editor");
  assert(
    "15 public path in sitemap INDEXABLE_TOOL_PATHS once",
    INDEXABLE_TOOL_PATHS.filter((p) => p === "/tools/image-editor").length === 1,
  );
  assert(
    "16 /dev/image-editor absent from sitemap",
    !INDEXABLE_TOOL_PATHS.some((p) => p.includes("/dev/image-editor")),
  );

  assert("17 TOOL_VISUALS has image-editor", Boolean(TOOL_VISUALS["image-editor"]));
  assert(
    "18 Tool Finder suppresses public editor",
    finder.includes("/tools/image-editor"),
  );
  assert(
    "19 Tool Finder still suppresses dev editor",
    finder.includes("/dev/image-editor"),
  );

  const editCreate = filterTools(SCANONIX_TOOLS, "", "edit-image");
  assert("20 Edit & Create has Image Editor", editCreate.some((t) => t.id === "image-editor"));
  assert(
    "21 Image Editor first in Edit & Create",
    editCreate[0]?.id === "image-editor",
    `got ${editCreate.map((t) => t.id).join(",")}`,
  );

  const searchHit = filterTools(SCANONIX_TOOLS, "image editor", "image");
  assert("22 search finds Image Editor", searchHit.some((t) => t.id === "image-editor"));

  assert(
    "23 Navbar Image Tools lists Image Editor first among tools",
    NAV_DROPDOWN_TOOLS.image.tools[0]?.href === "/tools/image-editor",
  );

  assert(
    "24 Image hub edit tools lead with Image Editor",
    IMAGE_HUB_EDIT_TOOLS[0]?.id === "image-editor" &&
      IMAGE_HUB_EDIT_TOOLS[0]?.href === "/tools/image-editor",
  );

  assert("25 public inventory is 41", SCANONIX_TOOLS.length === 41);
  assert(
    "26 Background Remover absent",
    !SCANONIX_TOOLS.some((t) => t.id === "background-remover"),
  );
  assert(
    "27 image filter count 17",
    SCANONIX_TOOLS.filter((t) => toolMatchesCategoryFilter(t.id, "image")).length === 17,
  );

  const fontSample = join(root, "public", "fonts", "editor", "inter", "400.woff2");
  assert("28 font assets available (inter/400.woff2)", existsSync(fontSample));

  assert(
    "29 SEO copy does not claim AI generative features",
    !/generative fill|background removal|layers|stickers/i.test(
      TOOL_SEO["image-editor"].metaDescription,
    ),
  );

  assert(
    "30 no ToolRoute/ToolShell on public editor page",
    !publicSource.includes("ToolRoute") && !publicSource.includes("ToolShell"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
