/**
 * Phase 130L-5F-3 — auth-gated Bright theme chrome guards.
 * Run: npx tsx scripts/verify-auth-theme-130l5f3.ts
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

function noForbiddenChrome(source: string) {
  return (
    !source.includes("text-white") &&
    !source.includes("border-white/") &&
    !source.includes("bg-black/20") &&
    !source.includes("bg-black/25") &&
    !source.includes("bg-black/30") &&
    !source.includes("bg-[#0c0c0c]") &&
    !source.includes("bg-[#0d1117]")
  );
}

console.log("\n130L-5F-3 auth-gated theme verification\n");

const accountHeader = read("components/account/AccountOverviewHeader.tsx");
assert(
  "AccountOverviewHeader H1 uses text-foreground (not text-white)",
  accountHeader.includes("text-foreground") &&
    !accountHeader.includes("text-white") &&
    accountHeader.includes('href="/account/billing"'),
);
assert(
  "AccountOverviewHeader Billing control is semantic (not btn-secondary white lock)",
  accountHeader.includes("border-border") &&
    accountHeader.includes("text-foreground") &&
    !accountHeader.includes("btn-secondary"),
);

const accountNav = read("components/account/AccountNav.tsx");
assert(
  "AccountNav active/hover states are semantic (no text-white lock)",
  accountNav.includes("text-foreground") &&
    accountNav.includes("text-foreground-muted") &&
    !accountNav.includes("text-white") &&
    !accountNav.includes("hover:text-white"),
);

const accountProfile = read("components/account/AccountProfilePanel.tsx");
assert(
  "AccountProfilePanel read-only values use semantic foreground",
  accountProfile.includes("text-foreground") &&
    accountProfile.includes("text-foreground-secondary") &&
    !accountProfile.includes("text-white"),
);

const accountSecurity = read("components/account/AccountSecurityPanel.tsx");
assert(
  "AccountSecurityPanel tiles use semantic surfaces",
  accountSecurity.includes("border-border") &&
    accountSecurity.includes("bg-surface-muted") &&
    accountSecurity.includes("text-foreground") &&
    noForbiddenChrome(accountSecurity),
);

const accountNotifications = read("components/account/AccountNotificationsPanel.tsx");
assert(
  "AccountNotificationsPanel rows use semantic surfaces",
  accountNotifications.includes("border-border") &&
    accountNotifications.includes("bg-surface-muted") &&
    accountNotifications.includes("text-foreground") &&
    accountNotifications.includes("handleToggle") &&
    noForbiddenChrome(accountNotifications),
);

const accountBilling = read("components/account/AccountBillingSection.tsx");
assert(
  "AccountBillingSection usage tiles are semantic",
  accountBilling.includes("border-border") &&
    accountBilling.includes("bg-surface-muted") &&
    accountBilling.includes("text-foreground") &&
    accountBilling.includes("fetchUsageSummary") &&
    noForbiddenChrome(accountBilling),
);

const historyPage = read("app/history/page.tsx");
const savedFilesPage = read("app/saved-files/page.tsx");
assert(
  "History page H1 uses text-foreground",
  historyPage.includes("text-foreground") && !historyPage.includes("text-white"),
);
assert(
  "Saved files page H1 uses text-foreground",
  savedFilesPage.includes("text-foreground") && !savedFilesPage.includes("text-white"),
);

const emptyState = read("components/common/EmptyState.tsx");
assert(
  "EmptyState icon well is semantic",
  emptyState.includes("border-border") &&
    emptyState.includes("bg-surface-muted") &&
    !emptyState.includes("border-white/10") &&
    !emptyState.includes("bg-black/20"),
);

const scanHistoryFiles = [
  "components/scan-history/ScanHistoryTable.tsx",
  "components/scan-history/ScanHistoryMobileCards.tsx",
  "components/scan-history/ScanHistoryActionsMenu.tsx",
  "components/scan-history/ScanHistoryDeleteDialog.tsx",
  "components/scan-history/ScanHistoryEmptyState.tsx",
  "components/scan-history/ScanHistorySummaryCards.tsx",
  "components/scan-history/ScanHistoryShell.tsx",
];
for (const rel of scanHistoryFiles) {
  const src = read(rel);
  const chromeOk =
    !src.includes("border-white/") &&
    !src.includes("text-white") &&
    !src.includes("bg-black/20") &&
    !src.includes("bg-black/25");
  assert(`${rel} chrome migrated (no dark-native locks)`, chromeOk);
}

const deleteDialog = read("components/scan-history/ScanHistoryDeleteDialog.tsx");
assert(
  "ScanHistoryDeleteDialog scrim preserved",
  deleteDialog.includes("bg-black/70"),
);
assert(
  "ScanHistoryDeleteDialog panel chrome is semantic",
  deleteDialog.includes("border-border") && deleteDialog.includes("text-foreground"),
);

const scanReportFiles = [
  "components/scan-report/ScanReportHeader.tsx",
  "components/scan-report/ScanReportStatusHero.tsx",
  "components/scan-report/ScanReportOverview.tsx",
  "components/scan-report/ScanReportThreats.tsx",
  "components/scan-report/ScanReportTimeline.tsx",
  "components/scan-report/ScanReportAiSummary.tsx",
  "components/scan-report/ScanReportAiRecommendations.tsx",
  "components/scan-report/ScanReportPerformance.tsx",
  "components/scan-report/ScanReportFiles.tsx",
  "components/scan-report/ScanReportDownloads.tsx",
  "components/scan-report/ScanReportDomainReputation.tsx",
  "components/scan-report/ScanReportFileIntelligence.tsx",
  "components/scan-report/ScanReportEmptySuccess.tsx",
];
for (const rel of scanReportFiles) {
  const src = read(rel);
  assert(
    `${rel} ordinary chrome migrated`,
    src.includes("text-foreground") &&
      !src.includes("text-white") &&
      !src.includes("border-white/") &&
      !src.includes("bg-[#0c0c0c]"),
  );
}

const statusHero = read("components/scan-report/ScanReportStatusHero.tsx");
assert(
  "ScanReportStatusHero severity accents preserved",
  statusHero.includes("border-emerald-500/20") &&
    statusHero.includes("border-amber-500/20") &&
    statusHero.includes("border-red-500/25") &&
    statusHero.includes("text-red-300") &&
    statusHero.includes("text-amber-200") &&
    statusHero.includes("text-emerald-300"),
);

const threats = read("components/scan-report/ScanReportThreats.tsx");
assert(
  "ScanReportThreats severity/destructive colors preserved",
  threats.includes("getSeverityStyles") &&
    threats.includes("border-scanonix-orange/20"),
);

const notFound = read("app/scan-results/[id]/not-found.tsx");
assert(
  "Scan result not-found H1 is semantic",
  notFound.includes("text-foreground") && !notFound.includes("text-white"),
);

const monitorFiles = [
  "components/monitors/MonitorsShell.tsx",
  "components/monitors/MonitorDetailShell.tsx",
  "components/monitors/MonitorHistoryShell.tsx",
  "components/monitors/MonitorButton.tsx",
];
for (const rel of monitorFiles) {
  const src = read(rel);
  assert(
    `${rel} ordinary chrome migrated`,
    src.includes("text-foreground") &&
      src.includes("border-border") &&
      !src.includes("border-white/") &&
      !src.includes("bg-[#0d1117]"),
  );
}

const monitorButton = read("components/monitors/MonitorButton.tsx");
assert(
  "MonitorButton modal scrim preserved",
  monitorButton.includes("bg-black/60"),
);
assert(
  "MonitorButton primary CTA keeps intentional white-on-orange",
  monitorButton.includes("bg-scanonix-orange") && monitorButton.includes("text-white"),
);

const dashboardQuick = read("components/dashboard/DashboardQuickActions.tsx");
const dashboardShortcuts = read("components/dashboard/DashboardCategoryShortcuts.tsx");
const dashboardPlan = read("components/dashboard/DashboardPlanCard.tsx");
assert(
  "Frozen Dashboard R1 QuickActions present (not auth-migrated)",
  dashboardQuick.includes("dashboard-quick-actions-heading") &&
    dashboardQuick.includes("surface-card") &&
    !dashboardQuick.includes("border-white/10"),
);
assert(
  "Frozen Dashboard R1 CategoryShortcuts present (not auth-migrated)",
  dashboardShortcuts.includes("dashboard-category-shortcuts-heading") &&
    dashboardShortcuts.includes("text-foreground"),
);
assert(
  "Frozen Dashboard R1 PlanCard present (not auth-migrated)",
  dashboardPlan.includes("DashboardPlanCard") &&
    dashboardPlan.includes("UsageCardSkeleton"),
);

const public5f2Bg = read("components/tools/background-remover/BackgroundRemoverTool.tsx");
const public5f2Qr = read("components/tools/qr-scanner/QrResultPanel.tsx");
assert(
  "Frozen public 5F-2 BG Remover still semantic from 5F-2",
  public5f2Bg.includes("text-foreground") && !public5f2Bg.includes("text-white"),
);
assert(
  "Frozen public 5F-2 QR result panel still semantic from 5F-2",
  public5f2Qr.includes("bg-surface-muted") && !public5f2Qr.includes("bg-black/40"),
);

const designSystem = read("styles/design-system.css");
assert(
  ".tool-card-neon untouched",
  designSystem.includes(".tool-card-neon"),
);

const brandPath = join(root, "public/scanonix_mark.png");
assert("Brand S asset path still present", existsSync(brandPath));

const faviconPath = join(root, "app/favicon.ico");
assert("Favicon asset path still present", existsSync(faviconPath));

console.log(`\nResult: ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}\n`);
process.exit(failed === 0 ? 0 : 1);
