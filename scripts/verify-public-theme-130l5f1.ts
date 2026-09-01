/**
 * Phase 130L-5F-1 — public P0/P1 Bright theme chrome guards.
 * Run: npx tsx scripts/verify-public-theme-130l5f1.ts
 */
import { existsSync, readFileSync } from "node:fs";
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

function read(rel: string) {
  const path = join(root, rel);
  assert(`${rel} exists`, existsSync(path));
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

console.log("\n130L-5F-1 public theme verification\n");

const contactPage = read("app/contact/page.tsx");
assert(
  "Contact H1/sidebar use text-foreground (not text-white)",
  contactPage.includes('text-foreground">') &&
    contactPage.includes("Contact Scanonix") &&
    !contactPage.includes("text-white") &&
    !contactPage.includes("bg-black/25"),
);

const contactForm = read("components/forms/ContactForm.tsx");
assert(
  "ContactForm labels/inputs are semantic",
  contactForm.includes("text-foreground") &&
    contactForm.includes("input-field") &&
    contactForm.includes("select-field") &&
    !contactForm.includes("text-white") &&
    !contactForm.includes("bg-black/30"),
);

const legal = read("components/legal/LegalDocumentLayout.tsx");
assert(
  "Legal headings use text-foreground (not text-white)",
  legal.includes("text-foreground") &&
    !legal.includes("text-white") &&
    !legal.includes("border-white/10") &&
    !legal.includes("text-yellow-100"),
);

const hub = read("components/image-tools/ImageToolsHub.tsx");
assert(
  "ImageToolsHub headings use text-foreground",
  hub.includes("text-foreground") && !hub.includes("text-white"),
);

const featured = read("components/image-tools/FeaturedBackgroundRemoverCard.tsx");
assert(
  "FeaturedBackgroundRemoverCard has no #0a0a0a / text-white shell",
  featured.includes("bg-surface") &&
    !featured.includes("bg-[#0a0a0a]") &&
    !featured.includes("text-white"),
);

const hubLink = read("components/image-tools/HubToolLink.tsx");
const converter = read("components/image-tools/ConverterGridCard.tsx");
assert(
  "Hub/converter cards use semantic surface (no #0a0a0a)",
  hubLink.includes("bg-surface") &&
    converter.includes("bg-surface") &&
    !hubLink.includes("bg-[#0a0a0a]") &&
    !converter.includes("bg-[#0a0a0a]") &&
    !hubLink.includes("text-white") &&
    !converter.includes("text-white"),
);

const translate = read("components/tools/ai-translate/AiTranslateTool.tsx");
assert(
  "AiTranslateTool labels/panels are semantic",
  translate.includes('text-foreground">Source text') &&
    translate.includes('text-foreground">Translation') &&
    !translate.includes("text-white") &&
    !translate.includes("bg-black/40") &&
    !translate.includes("bg-black/30"),
);

const combobox = read("components/tools/ai-translate/LanguageCombobox.tsx");
assert(
  "LanguageCombobox has no fixed #111111 shell",
  combobox.includes("bg-surface") &&
    !combobox.includes("bg-[#111111]") &&
    !combobox.includes("bg-black/40") &&
    !combobox.includes("text-white"),
);

const authInput = read("components/auth/AuthInput.tsx");
assert(
  "AuthInput label is semantic (not text-white)",
  authInput.includes("text-foreground") && !authInput.includes("text-white"),
);

const authShell = read("components/auth/AuthShell.tsx");
assert(
  "AuthShell divider uses border-border",
  authShell.includes("border-border") && !authShell.includes("border-white/10"),
);

// Consent theme migrated in 5F-2 — 5F-1 verifier only guards handler wiring
const consentBanner = read("components/analytics/ConsentBanner.tsx");
assert(
  "ConsentBanner accept/reject handlers preserved",
  consentBanner.includes("onClick={rejectAnalytics}") &&
    consentBanner.includes("onClick={acceptAnalytics}"),
);

console.log(`\nResult: ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}\n`);
process.exit(failed === 0 ? 0 : 1);
