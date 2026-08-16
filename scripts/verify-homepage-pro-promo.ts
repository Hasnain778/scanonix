/**
 * Homepage Pro promo verification (Phase 128F-FIX4).
 * Run: npx tsx scripts/verify-homepage-pro-promo.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  console.log("\nHomepage Pro promo verification (Phase 128F-FIX4)\n");

  const homepageSource = readFileSync(join(root, "app", "page.tsx"), "utf8");
  const promoSource = readFileSync(
    join(root, "components", "home", "ScanonixProPromo.tsx"),
    "utf8",
  );
  const cssSource = readFileSync(join(root, "styles", "design-system.css"), "utf8");

  const promoRenderCount = homepageSource.split("<ScanonixProPromo").length - 1;

  assert(
    "1 exactly one homepage Pro promo section render",
    promoRenderCount === 1 &&
      homepageSource.includes('from "@/components/home/ScanonixProPromo"'),
  );

  assert(
    "2 real Scanonix Pro copy (no iLovePDF wording)",
    promoSource.includes("Scanonix Pro") &&
      promoSource.includes("Unlock more with Scanonix Pro") &&
      !promoSource.toLowerCase().includes("ilovepdf") &&
      !promoSource.toLowerCase().includes("offline desktop") &&
      !promoSource.toLowerCase().includes("enterprise") &&
      !promoSource.toLowerCase().includes("unlimited usage"),
  );

  assert(
    "3 upgrade CTA uses existing pricing route",
    promoSource.includes('href="/pricing"') &&
      promoSource.includes("Upgrade to Pro") &&
      !promoSource.includes("create-checkout") &&
      !promoSource.includes("CheckoutButton"),
  );

  assert(
    "4 no duplicate Android promo in section",
    !promoSource.includes("Android") &&
      !promoSource.includes("PlayStore") &&
      !promoSource.includes("play.google.com"),
  );

  assert(
    "5 Pro visual uses centralized ToolVisual imports",
    promoSource.includes('from "@/components/tools/ToolVisual"') &&
      promoSource.includes("<ToolVisual") &&
      promoSource.includes('data-pro-promo-visual="tool-visuals"') &&
      promoSource.includes('data-tool-slug='),
  );

  assert(
    "6 mobile structure present (stacked grid + compact visual)",
    cssSource.includes(".scanonix-pro-promo__grid") &&
      cssSource.includes("grid-template-columns: 1fr") &&
      cssSource.includes("@media (max-width: 639px)") &&
      promoSource.includes("scanonix-pro-promo__copy"),
  );

  assert(
    "7 reduced-motion supported",
    cssSource.includes("@media (prefers-reduced-motion: reduce)") &&
      cssSource.includes(".scanonix-pro-promo__float-card") &&
      cssSource.includes("animation: none"),
  );

  assert(
    "8 verified Pro benefits only (security, 4K, AI, limits)",
    promoSource.includes("Protect, Unlock, and Redact PDF") &&
      promoSource.includes("4K background removal") &&
      promoSource.includes("Premium AI tools") &&
      promoSource.includes("500 ops/month"),
  );

  assert(
    "9 Pro user state shows manage/dashboard links",
    promoSource.includes("on Scanonix Pro") &&
      promoSource.includes("/account/billing") &&
      promoSource.includes("/dashboard") &&
      promoSource.includes("useProAccess"),
  );

  assert(
    "10 section placed before footer (inside main)",
    homepageSource.indexOf("<ScanonixProPromo") > homepageSource.indexOf("<ToolCategoriesSection") &&
      homepageSource.indexOf("<ScanonixProPromo") < homepageSource.indexOf("</main>") &&
      homepageSource.indexOf("<Footer") > homepageSource.indexOf("</main>"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
