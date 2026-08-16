/**
 * Footer social link verification (Phase 128F-FIX5).
 * Run: npx tsx scripts/verify-footer-social-links.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOCIAL_LINKS } from "../constants/social-links";

const root = process.cwd();
const LINKEDIN_URL = "https://www.linkedin.com/company/scanonix/";
const GITHUB_URL = "https://github.com/Scanonix";

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
  console.log("\nFooter social link verification (Phase 128F-FIX5)\n");

  const footerSource = readFileSync(join(root, "components", "layout", "Footer.tsx"), "utf8");
  const footerSocialSource = readFileSync(
    join(root, "components", "layout", "FooterSocialLinks.tsx"),
    "utf8",
  );
  const socialConfigSource = readFileSync(join(root, "constants", "social-links.ts"), "utf8");
  const combinedFooter = `${footerSource}\n${footerSocialSource}\n${socialConfigSource}`;

  const linkedInConfig = SOCIAL_LINKS.find((link) => link.platform === "LinkedIn");
  const gitHubConfig = SOCIAL_LINKS.find((link) => link.platform === "GitHub");

  assert(
    "1 LinkedIn link exists in footer social component",
    footerSocialSource.includes("SOCIAL_LINKS") &&
      footerSocialSource.includes("href={link.href}") &&
      footerSource.includes("<FooterSocialLinks />"),
  );

  assert(
    "2 URL exactly https://www.linkedin.com/company/scanonix/",
    linkedInConfig?.href === LINKEDIN_URL && socialConfigSource.includes(LINKEDIN_URL),
  );

  assert(
    "3 no ?viewAsMember=true in social config or footer",
    !combinedFooter.includes("viewAsMember=true"),
  );

  assert(
    "4 target=\"_blank\" on external social links",
    footerSocialSource.includes('target="_blank"'),
  );

  assert(
    "5 rel contains noopener noreferrer",
    footerSocialSource.includes('rel="noopener noreferrer"'),
  );

  assert(
    "6 accessible label Scanonix on LinkedIn exists",
    footerSocialSource.includes('aria-label={link.ariaLabel}') &&
      linkedInConfig?.ariaLabel === "Scanonix on LinkedIn",
  );

  const linkedInUrlMatches = combinedFooter.match(
    /https:\/\/www\.linkedin\.com\/company\/scanonix\//g,
  );
  assert(
    "7 only ONE LinkedIn company URL in footer stack",
    linkedInUrlMatches !== null && linkedInUrlMatches.length === 1,
    linkedInUrlMatches ? `found ${linkedInUrlMatches.length}` : "found 0",
  );

  assert(
    "8 footer structurally valid at 390px (responsive grid + brand column)",
    footerSource.includes("page-container") &&
      footerSource.includes("lg:col-span-4") &&
      footerSource.includes("max-w-sm") &&
      footerSource.includes("grid gap-10") &&
      footerSocialSource.includes("flex flex-wrap"),
  );

  assert(
    "9 footer integrates social row without new column",
    footerSource.includes("<FooterSocialLinks />") &&
      !footerSource.includes("lg:col-span-5") &&
      footerSource.includes("lg:col-span-4"),
  );

  assert(
    "10 Android app link preserved below social row",
    footerSource.includes("PLAY_STORE_URL") && footerSource.includes("Get the Android app"),
  );

  assert(
    "11 GitHub link exists in footer social component",
    footerSocialSource.includes("GitHubIcon") &&
      gitHubConfig !== undefined &&
      socialConfigSource.includes(GITHUB_URL),
  );

  assert(
    "12 URL exactly https://github.com/Scanonix",
    gitHubConfig?.href === GITHUB_URL && socialConfigSource.includes(GITHUB_URL),
  );

  assert(
    "13 accessible label Scanonix on GitHub exists",
    gitHubConfig?.ariaLabel === "Scanonix on GitHub",
  );

  const gitHubUrlMatches = combinedFooter.match(/https:\/\/github\.com\/Scanonix/g);
  assert(
    "14 only ONE GitHub organization URL in footer stack",
    gitHubUrlMatches !== null && gitHubUrlMatches.length === 1,
    gitHubUrlMatches ? `found ${gitHubUrlMatches.length}` : "found 0",
  );

  assert(
    "15 GitHub hover uses Scanonix orange glow (not permanent)",
    footerSocialSource.includes("hover:border-scanonix-orange") &&
      footerSocialSource.includes("hover:shadow-[0_0_18px_rgba(255,106,0,0.32)]") &&
      !footerSocialSource.includes("border-scanonix-orange/55 border") &&
      footerSocialSource.includes("GitHub:"),
  );

  assert(
    "16 LinkedIn and GitHub render side-by-side in social row",
    footerSocialSource.includes("flex flex-wrap items-center gap-2") &&
      SOCIAL_LINKS.length === 2 &&
      SOCIAL_LINKS[0]?.platform === "LinkedIn" &&
      SOCIAL_LINKS[1]?.platform === "GitHub",
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
