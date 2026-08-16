/**
 * Homepage Android app CTA verification (Phase 128E-FIX3).
 * Run: npx tsx scripts/verify-homepage-app-cta.ts
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
  console.log("\nHomepage app CTA verification (Phase 128E-FIX3)\n");

  const homepageSource = readFileSync(join(root, "app", "page.tsx"), "utf8");
  const navbarSource = readFileSync(join(root, "components", "layout", "Navbar.tsx"), "utf8");
  const heroSource = readFileSync(join(root, "components", "sections", "HomeHero.tsx"), "utf8");
  const footerSource = readFileSync(join(root, "components", "layout", "Footer.tsx"), "utf8");

  assert(
    "1 homepage body does not render HomeAndroidPromo",
    !homepageSource.includes("<HomeAndroidPromo") &&
      !homepageSource.includes('from "@/components/sections/HomeAndroidPromo"'),
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
    "5 homepage hero contains Get the Android App",
    heroSource.includes("Get the Android App") &&
      heroSource.includes('location="hero"') &&
      heroSource.includes("PlayStoreLink"),
  );

  assert(
    "6 hero CTA uses production Play Store URL",
    heroSource.includes("PlayStoreLink") &&
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
