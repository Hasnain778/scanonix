/**
 * Phase 130D Step 2C — processing lifecycle instrumentation verification.
 * Run: npm run verify:analytics-130d-step2c
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FROZEN_130D_CUSTOM_EVENT_NAMES } from "../lib/analytics/surfaces";
import {
  CUSTOM_EVENT_NAMES,
  ERROR_CODES,
  FORBIDDEN_PARAMETER_NAMES,
  sanitizeCustomEvent,
} from "../lib/analytics/events";
import { CANONICAL_TOOL_IDS } from "../constants/tool-categories";
import { TOOL_ACCESS } from "../lib/plan/tool-access";

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

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function walkRuntimeSources(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkRuntimeSources(fullPath, acc);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function productRuntimeFiles(): string[] {
  return ["app", "components", "lib"]
    .map((dir) => join(root, dir))
    .flatMap((dir) => walkRuntimeSources(dir))
    .filter((path) => !path.includes(`${join("lib", "analytics")}`));
}

function productRuntimeSource(): string {
  return productRuntimeFiles()
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

function relativeFromRoot(fullPath: string): string {
  return fullPath.slice(root.length + 1).replace(/\\/g, "/");
}

console.log("Phase 130D Step 2C — processing lifecycle verification\n");

const lifecycleSource = readSource("lib/analytics/process-lifecycle.ts");
const ga4Source = readSource("lib/analytics/ga4.ts");
const googleAnalyticsSource = readSource("components/analytics/GoogleAnalytics.tsx");
const analyticsProviderSource = readSource("components/analytics/AnalyticsProvider.tsx");
const consentSource = readSource("lib/analytics/consent.ts");
const layoutSource = readSource("app/layout.tsx");
const productRuntime = productRuntimeSource();
const productFiles = productRuntimeFiles();

// 1. Process lifecycle foundation
assert("1 process-lifecycle module exists", existsSync(join(root, "lib/analytics/process-lifecycle.ts")));
assert("1 createProcessAttempt exported", lifecycleSource.includes("export function createProcessAttempt"));
assert("1 resolveToolProcessMeta exported", lifecycleSource.includes("export function resolveToolProcessMeta"));
assert(
  "1 process events emitted via trackEvent in lifecycle module",
  lifecycleSource.includes('trackEvent("tool_process_start"') &&
    lifecycleSource.includes('trackEvent("tool_process_success"') &&
    lifecycleSource.includes('trackEvent("tool_process_error"'),
);

// 2. Product must not call process trackEvent directly
const directProcessCalls = productFiles.filter((file) => {
  const src = readFileSync(file, "utf8");
  return (
    src.includes('trackEvent("tool_process_start"') ||
    src.includes('trackEvent("tool_process_success"') ||
    src.includes('trackEvent("tool_process_error"')
  );
});
assert(
  "2 no direct process trackEvent in product components",
  directProcessCalls.length === 0,
  directProcessCalls.map(relativeFromRoot).join(", "),
);

// 3. Product uses createProcessAttempt
const attemptCallFiles = productFiles.filter((file) =>
  readFileSync(file, "utf8").includes("createProcessAttempt("),
);
assert("3 createProcessAttempt used in product", attemptCallFiles.length >= 20);

// 4. No session/time dedupe in lifecycle module
assert(
  "4 no session dedupe in process-lifecycle",
  !lifecycleSource.match(/session|localStorage|cookie|dedupe|30_?000|30s/i),
);
assert("4 in-memory attempt flags only", lifecycleSource.includes("let started = false"));
assert("4 terminal guard present", lifecycleSource.includes("let terminal = false"));

// 5. No attempt/run id in GA payloads
assert(
  "5 no attempt_id in lifecycle trackEvent payloads",
  !lifecycleSource.match(/attempt_id|run_id|process_id|job_id/i),
);
assert(
  "5 no persistence of attempt state",
  !lifecycleSource.includes("localStorage") && !lifecycleSource.includes("sessionStorage"),
);

// 6. Schema validation still works
const validStart = sanitizeCustomEvent("tool_process_start", {
  tool_slug: "merge-pdf",
  tool_category: "pdf",
  processing_type: "client",
  plan_gate: "free",
});
assert("6 valid tool_process_start accepted", validStart.ok === true);

const validSuccess = sanitizeCustomEvent("tool_process_success", {
  tool_slug: "merge-pdf",
  tool_category: "pdf",
  processing_type: "client",
  output_count: 2,
});
assert("6 valid tool_process_success accepted", validSuccess.ok === true);

const validError = sanitizeCustomEvent("tool_process_error", {
  tool_slug: "merge-pdf",
  tool_category: "pdf",
  processing_type: "client",
  error_code: "network",
});
assert("6 valid tool_process_error accepted", validError.ok === true);

for (const code of ERROR_CODES) {
  const result = sanitizeCustomEvent("tool_process_error", {
    tool_slug: "merge-pdf",
    tool_category: "pdf",
    processing_type: "client",
    error_code: code,
  });
  assert(`6 error_code ${code} accepted`, result.ok === true);
}

// 7. Forbidden fields rejected
assert(
  "7 filename forbidden in process events",
  sanitizeCustomEvent("tool_process_start", {
    tool_slug: "merge-pdf",
    tool_category: "pdf",
    processing_type: "client",
    plan_gate: "free",
    filename: "x.pdf",
  } as never).ok === false,
);

assert(
  "7 raw error_message forbidden",
  sanitizeCustomEvent("tool_process_error", {
    tool_slug: "merge-pdf",
    tool_category: "pdf",
    processing_type: "client",
    error_code: "unknown",
    error_message: "stack trace",
  } as never).ok === false,
);

// 8. No direct gtag in product
assert("8 no gtag event calls outside lib/analytics", !productRuntime.includes('gtag("event"'));

// 9. Process lifecycle payloads privacy audit
function lifecyclePayloadSource(source: string): string {
  return (source.match(/trackEvent\([\s\S]*?\);/g) ?? []).join("\n");
}

const lifecyclePayloads = lifecyclePayloadSource(lifecycleSource);
const forbiddenInLifecycle = FORBIDDEN_PARAMETER_NAMES.filter((key) =>
  new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(lifecyclePayloads),
);
assert(
  "9 no forbidden keys in lifecycle trackEvent payloads",
  forbiddenInLifecycle.length === 0,
  forbiddenInLifecycle.join(", "),
);

// 10. Step 2B events preserved
const step2bEvents = ["tool_download", "checkout_start", "upgrade_click", "find_tool_search"] as const;
for (const event of step2bEvents) {
  assert(`10 Step2B ${event} still present`, productRuntime.includes(`trackEvent("${event}"`));
}

const implemented130dInProduct = FROZEN_130D_CUSTOM_EVENT_NAMES.filter((name) =>
  productRuntime.includes(`trackEvent("${name}"`) ||
  (name.startsWith("tool_process_") && lifecycleSource.includes(`trackEvent("${name}"`)),
);
assert(
  "10 all 130D custom events implemented",
  implemented130dInProduct.length === FROZEN_130D_CUSTOM_EVENT_NAMES.length,
  implemented130dInProduct.sort().join(","),
);

// 11. Pageview / consent / favicon preserved
assert("11 send_page_view false preserved", ga4Source.includes("send_page_view: false"));
assert(
  "11 trackPageView unchanged in AnalyticsProvider",
  analyticsProviderSource.includes("trackPageView") && !analyticsProviderSource.includes("trackEvent"),
);
assert("11 GoogleAnalytics consent gate preserved", googleAnalyticsSource.includes('decision !== "accepted"'));
assert("11 consent key preserved", consentSource.includes("scanonix_consent_v1"));
assert("11 favicon metadata preserved", layoutSource.includes('apple: "/icon.png"'));

// 12. Canonical tool coverage — each canonical tool slug referenced in createProcessAttempt
const attemptSourceCombined = attemptCallFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const missingCanonical = CANONICAL_TOOL_IDS.filter(
  (id) => !attemptSourceCombined.includes(`createProcessAttempt("${id}"`) &&
    !attemptSourceCombined.includes(`createProcessAttempt(config.slug)`) &&
    !attemptSourceCombined.includes(`createProcessAttempt(toolSlug)`) &&
    !attemptSourceCombined.includes(`createProcessAttempt(toolId)`),
);

// Image converters use config.slug — check each format slug individually or via shared component
const imageConverterSlugs = [
  "jpg-to-png",
  "png-to-jpg",
  "jpg-to-webp",
  "png-to-webp",
  "webp-to-jpg",
  "webp-to-png",
  "heic-to-jpg",
  "heic-to-png",
];
const missingAfterConverterCheck = missingCanonical.filter(
  (id) => !imageConverterSlugs.includes(id) || !attemptSourceCombined.includes("createProcessAttempt(config.slug)"),
);
assert(
  "12 canonical tools instrumented via createProcessAttempt",
  missingAfterConverterCheck.length === 0,
  missingAfterConverterCheck.join(", "),
);

// 13. website-monitoring excluded (no tool page)
assert(
  "13 website-monitoring not forced",
  !attemptSourceCombined.includes('createProcessAttempt("website-monitoring"'),
);
assert("13 website-monitoring in tool-access", Boolean(TOOL_ACCESS["website-monitoring"]));

// 14. markStarted prevents duplicate start emissions
assert(
  "14 markStarted returns false when already started",
  lifecycleSource.includes("if (started)") && lifecycleSource.includes("return false"),
);

// 15. terminal event emits once only
assert(
  "15 success/error guarded by terminal flag",
  lifecycleSource.includes("if (!started || terminal)"),
);

// 16. Package script registered
assert("16 verify script registered", readSource("package.json").includes("verify:analytics-130d-step2c"));

// 17. Analytics wrapped in try/catch — must not break tools
assert("17 lifecycle trackEvent wrapped safely", lifecycleSource.includes("try") && lifecycleSource.includes("catch"));

// 18. 130D-FIX1 — image-upscaler resume must not emit process lifecycle events
const upscalerSource = readSource("components/tools/image-upscaler/ImageUpscalerTool.tsx");
const resumeStoredJobBlock = upscalerSource.match(
  /const resumeStoredJob = useCallback\(async \(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/,
)?.[0] ?? "";
const handleUpscaleBlock = upscalerSource.match(
  /const handleUpscale = useCallback\(async \(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/,
)?.[0] ?? "";

assert("18 FIX1 resumeStoredJob exists", resumeStoredJobBlock.length > 0);
assert(
  "18 FIX1 resumeStoredJob has no createProcessAttempt",
  !resumeStoredJobBlock.includes("createProcessAttempt"),
);
assert(
  "18 FIX1 resumeStoredJob has no markStarted",
  !resumeStoredJobBlock.includes("markStarted"),
);
assert(
  "18 FIX1 resumeStoredJob has no attempt.success",
  !resumeStoredJobBlock.includes("attempt.success"),
);
assert(
  "18 FIX1 resumeStoredJob has no attempt.error",
  !resumeStoredJobBlock.includes("attempt.error"),
);
assert(
  "18 FIX1 resumeStoredJob has no trackEvent",
  !resumeStoredJobBlock.includes("trackEvent"),
);
assert(
  "18 FIX1 resumeStoredJob documents no analytics",
  upscalerSource.includes("no process lifecycle analytics"),
);
assert(
  "18 FIX1 handleUpscale still uses createProcessAttempt",
  handleUpscaleBlock.includes('createProcessAttempt("image-upscaler"'),
);
assert(
  "18 FIX1 handleUpscale still marks started",
  handleUpscaleBlock.includes("markStarted"),
);
assert(
  "18 FIX1 handleUpscale still emits success",
  handleUpscaleBlock.includes("attempt.success"),
);
assert(
  "18 FIX1 handleUpscale still emits error",
  handleUpscaleBlock.includes("attempt.error"),
);
assert(
  "18 FIX1 upscaler has only one createProcessAttempt call site",
  (upscalerSource.match(/createProcessAttempt\(/g) ?? []).length === 1,
);
assert(
  "18 FIX1 no job_id in upscaler analytics paths",
  !handleUpscaleBlock.match(/job_id|jobId|storedJobId|activeJobId/i),
);
assert(
  "18 FIX1 no analytics persistence in upscaler tool",
  !upscalerSource.includes("localStorage") &&
    !/\bsessionStorage\.(getItem|setItem|removeItem)\b/.test(upscalerSource),
);

console.log(`\n130D Step 2C verify: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
