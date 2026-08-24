/**
 * Homepage Android app CTA verification (Phase 128E-FIX3 / 130J-2B).
 * Run: npx tsx scripts/verify-homepage-app-cta.ts
 *
 * Approved architecture (130J tool-first homepage):
 * - Android CTA lives in HomeAndroidPromo secondary content, not HomeHero.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAY_STORE_URL } from "../config/site";

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
  console.log("\nHomepage app CTA verification (Phase 130J-2B)\n");

  const homepageSource = readFileSync(join(root, "app", "page.tsx"), "utf8");
  const navbarSource = readFileSync(join(root, "components", "layout", "Navbar.tsx"), "utf8");
  const heroSource = readFileSync(join(root, "components", "sections", "HomeHero.tsx"), "utf8");
  const androidPromoSource = readFileSync(
    join(root, "components", "sections", "HomeAndroidPromo.tsx"),
    "utf8",
  );
  const footerSource = readFileSync(join(root, "components", "layout", "Footer.tsx"), "utf8");

  assert(
    "1 homepage body renders HomeAndroidPromo as secondary content",
    homepageSource.includes("<HomeAndroidPromo") &&
      homepageSource.includes('from "@/components/sections/HomeAndroidPromo"'),
  );

  assert(
    "2 desktop header does not contain Get Android App CTA",
    !navbarSource.includes('location="navbar"') &&
      !navbarSource.match(/Get Android App[\s\S]*location="navbar"/) &&
      !navbarSource.includes("NAVBAR_APP_CTA_CLASS"),
  );

  assert(
    "3 mobile header does not contain compact App CTA",
    !navbarSource.includes('location="navbar-mobile"') &&
      !navbarSource.includes("MOBILE_HEADER_APP_CTA_CLASS"),
  );

  assert(
    "4 mobile nav does not contain prominent Get Android App CTA",
    !navbarSource.includes('location="mobile-nav"') &&
      !navbarSource.includes("MOBILE_NAV_APP_CTA_CLASS"),
  );

  assert(
    "5 homepage hero does not contain Android App CTA",
    !heroSource.includes("Get the Android App") &&
      !heroSource.includes('location="hero"') &&
      !heroSource.includes("PlayStoreLink"),
  );

  assert(
    "6 HomeAndroidPromo uses production Play Store URL via PlayStoreLink",
    androidPromoSource.includes("PlayStoreLink") &&
      androidPromoSource.includes('location="promo-section"') &&
      PLAY_STORE_URL === "https://play.google.com/store/apps/details?id=com.scanonix.app",
  );

  assert(
    "7 footer Android link preserved as secondary",
    footerSource.includes("PLAY_STORE_URL") &&
      footerSource.includes("Get the Android app"),
  );

  assert(
    "8 mobile drawer footer retains subtle Android App link",
    navbarSource.includes('label: "Android App"') &&
      navbarSource.includes("MOBILE_FOOTER_LINKS"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
