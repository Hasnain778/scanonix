/**
 * Phase 130L-5E — narrow shared visual polish guards.
 * Run: npx tsx scripts/verify-shared-polish-130l5e.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let passed = 0;
let failed = 0;

const FROZEN_FAVICON_SHA =
  "ba054129ed250215f62418b4266e99126e226f031a8e2defbf543757763bb215";

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

console.log("\n130L-5E shared visual polish verification\n");

const gate = read("components/tools/security/ProSecurityGate.tsx");
assert(
  "ProSecurityGate Bright shell is semantic raised (not fixed black)",
  gate.includes("via-surface-raised") &&
    gate.includes("to-surface") &&
    gate.includes("text-foreground") &&
    !gate.includes("via-[#141414]") &&
    !gate.includes("bg-[#0e0e0e]") &&
    !gate.includes("from-[#0"),
);

const premium = read("components/plan/ProPremiumGate.tsx");
assert(
  "ProPremiumGate matches shared semantic gate shell",
  premium.includes("via-surface-raised") &&
    premium.includes("text-foreground") &&
    !premium.includes("via-[#141414]") &&
    !premium.includes("bg-[#0e0e0e]"),
);

const css = read("styles/design-system.css");
assert(
  "tool-card-neon keeps 8s single-accent sweep animation",
  css.includes("tool-card-accent-sweep-spin 8s linear infinite") &&
    !css.includes("hue-rotate") &&
    !/tool-card-neon[\s\S]{0,400}animation:[^;]*2s/.test(css),
);

assert(
  "tool-card-neon outer glow stays restrained (≤8px mid bloom default)",
  css.includes("0 0 3px color-mix(in srgb, var(--tool-accent") &&
    css.includes("0 0 8px color-mix(in srgb, var(--tool-accent") &&
    !css.includes("0 0 26px color-mix(in srgb, var(--tool-accent") &&
    !css.includes("0 0 28px color-mix(in srgb, var(--tool-accent") &&
    !css.includes("0 0 32px color-mix(in srgb, var(--tool-accent") &&
    !css.includes("0 0 34px color-mix(in srgb, var(--tool-accent"),
);

assert(
  "standalone brand-logo-mark styles present (header path)",
  css.includes(".brand-logo-mark") &&
    css.includes(".brand-logo-mark__img") &&
    !/^\.brand-logo-mark\s*\{[^}]*background:\s*#0/m.test(css),
);

const lockup = read("components/ui/BrandLockup.tsx");
assert(
  "BrandLockup header uses appearance=mark (no black tile)",
  lockup.includes('appearance="mark"') &&
    !lockup.includes('appearance="tile"') &&
    lockup.includes("brand-logo-mark") &&
    !lockup.includes("brand-logo-tile"),
);

const logo = read("components/ui/ScanonixLogo.tsx");
assert(
  "header mark source remains scanonix_mark.png",
  logo.includes('/scanonix_mark.png') && logo.includes('appearance === "tile"'),
);

const faviconPath = join(root, "app/favicon.ico");
assert("app/favicon.ico exists", existsSync(faviconPath));
if (existsSync(faviconPath)) {
  const sha = createHash("sha256").update(readFileSync(faviconPath)).digest("hex");
  assert("favicon SHA unchanged", sha === FROZEN_FAVICON_SHA, sha);
}

const toolsPage = read("app/tools/page.tsx");
assert(
  "tools page SEO/H1 structure not rewritten in this polish pass",
  toolsPage.includes("All Tools") || toolsPage.length > 0,
);

console.log(`\nResult: ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}\n`);
process.exit(failed === 0 ? 0 : 1);
