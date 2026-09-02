/**
 * Phase 130L-5G — admin Bright/Dark theme chrome guards.
 * Run: npx tsx scripts/verify-admin-theme-130l5g.ts
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

function noOrdinaryDarkLocks(source: string) {
  return (
    !source.includes("bg-black/20") &&
    !source.includes("bg-black/30") &&
    !source.includes("border-white/") &&
    !source.includes("text-neutral-") &&
    !source.includes("text-gray-") &&
    !source.includes("hover:text-white") &&
    !source.includes("hover:bg-white/")
  );
}

console.log("\n130L-5G admin theme verification\n");

const adminCharts = read("components/admin/AdminCharts.tsx");
assert(
  "AdminCharts ordinary text uses semantic foreground",
  adminCharts.includes("text-foreground") &&
    !adminCharts.includes("text-white") &&
    adminCharts.includes("bg-scanonix-orange"),
);
assert(
  "AdminCharts progress track uses semantic surface-muted",
  adminCharts.includes("bg-surface-muted") && !adminCharts.includes("bg-white/10"),
);

const adminNav = read("components/admin/AdminNav.tsx");
assert(
  "AdminNav active state preserves orange + white",
  adminNav.includes("bg-scanonix-orange text-white"),
);
assert(
  "AdminNav inactive states are semantic",
  adminNav.includes("text-foreground-muted") &&
    adminNav.includes("hover:text-foreground") &&
    !adminNav.includes("hover:text-white"),
);

const adminUsers = read("components/admin/AdminUsersPanel.tsx");
assert(
  "AdminUsersPanel filters and table chrome semantic",
  adminUsers.includes("border-border") &&
    adminUsers.includes("bg-surface-muted") &&
    adminUsers.includes("text-foreground") &&
    noOrdinaryDarkLocks(adminUsers),
);
assert(
  "AdminUsersPanel status badges preserved",
  adminUsers.includes("bg-emerald-500/15 text-emerald-300") &&
    adminUsers.includes("bg-red-500/15 text-red-300"),
);

const adminUserDetail = read("components/admin/AdminUserDetailPanel.tsx");
assert(
  "AdminUserDetailPanel headings and values semantic",
  adminUserDetail.includes("text-foreground") &&
    adminUserDetail.includes("text-foreground-secondary") &&
    !adminUserDetail.includes("text-white") &&
    noOrdinaryDarkLocks(adminUserDetail),
);

const adminScans = read("components/admin/AdminScansPanel.tsx");
assert(
  "AdminScansPanel filters and table chrome semantic",
  adminScans.includes("border-border") &&
    adminScans.includes("text-foreground") &&
    noOrdinaryDarkLocks(adminScans),
);
assert(
  "AdminScansPanel destructive delete action preserved",
  adminScans.includes("text-red-300"),
);

const adminSubscriptions = read("components/admin/AdminSubscriptionsPanel.tsx");
assert(
  "AdminSubscriptionsPanel table chrome semantic",
  adminSubscriptions.includes("border-border") &&
    adminSubscriptions.includes("bg-surface-muted") &&
    adminSubscriptions.includes("text-foreground") &&
    noOrdinaryDarkLocks(adminSubscriptions),
);

const adminMonitoring = read("components/admin/AdminMonitoringPanel.tsx");
assert(
  "AdminMonitoringPanel headings, stats, and table semantic",
  adminMonitoring.includes("text-foreground") &&
    adminMonitoring.includes("border-border") &&
    !adminMonitoring.includes("text-white") &&
    noOrdinaryDarkLocks(adminMonitoring),
);

const adminSystem = read("components/admin/AdminSystemPanel.tsx");
assert(
  "AdminSystemPanel section headings and rows semantic",
  adminSystem.includes("text-foreground") &&
    adminSystem.includes("border-border") &&
    !adminSystem.includes("text-white") &&
    noOrdinaryDarkLocks(adminSystem),
);
assert(
  "AdminSystemPanel health badges preserved",
  adminSystem.includes("bg-emerald-500/15 text-emerald-300") &&
    adminSystem.includes("bg-amber-500/15 text-amber-300"),
);

const adminFiles = [
  "components/admin/AdminCharts.tsx",
  "components/admin/AdminNav.tsx",
  "components/admin/AdminUsersPanel.tsx",
  "components/admin/AdminUserDetailPanel.tsx",
  "components/admin/AdminScansPanel.tsx",
  "components/admin/AdminSubscriptionsPanel.tsx",
  "components/admin/AdminMonitoringPanel.tsx",
  "components/admin/AdminSystemPanel.tsx",
];
for (const rel of adminFiles) {
  if (rel === "components/admin/AdminNav.tsx") continue;
  const src = read(rel);
  assert(`${rel} has no ordinary text-white locks`, !src.includes("text-white"));
}
assert(
  "AdminNav only text-white is active orange CTA",
  (adminNav.match(/text-white/g) ?? []).length === 1 &&
    adminNav.includes("bg-scanonix-orange text-white"),
);

const billingSuccess = read("app/billing/success/page.tsx");
const billingClient = read("components/billing/BillingSuccessClient.tsx");
assert(
  "billing/success page untouched",
  billingSuccess.includes("AuthShell") && !billingSuccess.includes("text-white"),
);
assert(
  "BillingSuccessClient untouched",
  billingClient.includes("text-scanonix-muted") && !billingClient.includes("bg-black/"),
);

const sidebarBrand = read("components/ui/BrandLockup.tsx");
assert(
  "sidebar brand R1B proportions untouched",
  sidebarBrand.includes('variant === "sidebar"') &&
    sidebarBrand.includes("logoSize = isDesktop ? 50 : isFooter ? 32 : isSidebar ? 44 : 40") &&
    sidebarBrand.includes("w-[7.875rem]"),
);

const publicNavbar = read("components/layout/Navbar.tsx");
assert(
  "public Navbar untouched",
  publicNavbar.includes("NavbarBrand") && !publicNavbar.includes("layout=\"sidebar\""),
);

const faviconPath = join(root, "app/favicon.ico");
assert("Favicon asset path still present", existsSync(faviconPath));

const brandPath = join(root, "public/scanonix_mark.png");
assert("Brand S asset path still present", existsSync(brandPath));

console.log(`\nResult: ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}\n`);
process.exit(failed === 0 ? 0 : 1);
