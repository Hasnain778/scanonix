/**
 * Homepage Android app CTA verification (Phase 128E-FIX3 / 130J-2B).
 * Run: npx tsx scripts/verify-homepage-app-cta.ts
 *
 * Play Store access lives in the footer, not the header, mobile menu, or homepage promo.
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
    "1 homepage body does not render the Android promo section",
    !homepageSource.includes("<HomeAndroidPromo") &&
      !homepageSource.includes('from "@/components/sections/HomeAndroidPromo"'),
  );

  assert(
    "2 desktop header has no Google Play CTA",
    !navbarSource.includes('location="navbar"') &&
      !navbarSource.includes("PlayStoreLink") &&
      !navbarSource.includes("nav-play-badge"),
  );

  assert(
    "3 mobile header bar has no Google Play CTA",
    !navbarSource.includes('location="navbar-mobile"') &&
      !navbarSource.includes("PlayStoreLink"),
  );

  assert(
    "4 mobile menu has no Google Play CTA",
    !navbarSource.includes('location="mobile-nav"') &&
      !navbarSource.includes("PlayStoreLink"),
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
    "7 footer uses the official Play badge",
    footerSource.includes("PlayStoreLink") &&
      footerSource.includes('location="footer"') &&
      footerSource.includes('variant="badge"'),
  );

  assert(
    "8 navigation does not advertise an Android app button",
    !navbarSource.includes('label: "Android App"') &&
      !navbarSource.includes("PlayStoreLink"),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
