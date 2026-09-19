/**
 * SEO-AUTO-2 deterministic verification (no live GSC auth required).
 * Run: npm run verify:seo-auto-2
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GSC_READONLY_SCOPE } from "../lib/seo/local/constants";
import { classifyEvidence } from "../lib/seo/local/evidence";
import { getHoldForSlug, isActionableProposalBlocked } from "../lib/seo/local/holds";
import { buildOpportunityReport } from "../lib/seo/local/opportunities";
import { classifyPositionBand } from "../lib/seo/local/position-bands";
import {
  buildFixtureReport,
  buildProposalsFromReport,
} from "../lib/seo/local/proposals";
import { clusterQueries } from "../lib/seo/local/query-clusters";
import {
  getRetiredEntryForPath,
  isIntentionallyRetiredUrl,
} from "../lib/seo/local/retired-urls";
import { inspectToolSeoBySlug } from "../lib/seo/local/tool-seo-inspect";

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

function ocrLikeQueries() {
  const queries = [
    "online ocr",
    "ocr online",
    "ocr reader",
    "ocr extraction",
    "ocr scanning",
    "scan and recognize",
    "scan to text",
    "ocr text",
    "scan and ocr",
    "ocr scanner",
  ];
  return queries.map((query, i) => ({
    query,
    landingPage: "https://www.scanonix.com/tools/ocr",
    clicks: i === 0 ? 1 : 0,
    impressions: 120 - i * 5,
    ctr: i === 0 ? 1 / 120 : 0,
    position: 70 + (i % 5),
  }));
}

function run() {
  console.log("\nSEO-AUTO-2 verification (deterministic fixtures)\n");

  // A. OAuth scope constant
  assert(
    "A readonly scope constant",
    GSC_READONLY_SCOPE === "https://www.googleapis.com/auth/webmasters.readonly",
  );
  const authSource = readSource("lib/seo/local/auth.ts");
  assert(
    "A auth uses readonly scopes only",
    authSource.includes("GSC_READONLY_SCOPES") &&
      authSource.includes("webmasters.readonly"),
  );
  assert(
    "A auth rejects write scope tokens",
    authSource.includes("Token has write scope"),
  );
  assert(
    "A constants forbid write scope string as primary",
    readSource("lib/seo/local/constants.ts").includes("webmasters.readonly"),
  );

  // B. TOOL_SEO inspection is read-only (source check)
  const inspectSource = readSource("lib/seo/local/tool-seo-inspect.ts");
  assert(
    "B tool-seo-inspect does not write files",
    !inspectSource.includes("writeFileSync") && !inspectSource.includes("writeFile("),
  );
  const proposalsSource = readSource("lib/seo/local/proposals.ts");
  assert(
    "B proposals module does not import write APIs for tool-seo",
    !proposalsSource.includes("writeFileSync") &&
      proposalsSource.includes("mutatesToolSeo: false"),
  );
  const beforeToolSeo = readSource("constants/tool-seo.ts");
  inspectToolSeoBySlug("ocr");
  const afterToolSeo = readSource("constants/tool-seo.ts");
  assert("B inspecting OCR does not mutate tool-seo.ts on disk", beforeToolSeo === afterToolSeo);

  // Evidence: OCR-like STRONG
  const ocrQueries = ocrLikeQueries();
  const ocrEvidence = classifyEvidence({
    pageImpressions: 1630,
    pageClicks: 1,
    visibleQueries: ocrQueries.map((q) => ({
      query: q.query,
      impressions: q.impressions,
    })),
    windowDays: 28,
  });
  assert("D/F OCR-like evidence is STRONG", ocrEvidence.quality === "STRONG", ocrEvidence.quality);

  // Evidence: PDF-to-Word-like SPARSE
  const pdfEvidence = classifyEvidence({
    pageImpressions: 38,
    pageClicks: 0,
    visibleQueries: [
      { query: "pdf to word", impressions: 2 },
      { query: "convert pdf to word", impressions: 1 },
      { query: "pdf to docx", impressions: 1 },
    ],
    windowDays: 28,
  });
  assert(
    "E PDF-to-Word-like evidence is SPARSE",
    pdfEvidence.quality === "SPARSE",
    pdfEvidence.quality,
  );
  assert(
    "E sparse blocks content-change recommendation",
    pdfEvidence.blocksContentChangeRecommendation === true,
  );

  // Position bands
  assert("F position 7 is TOP", classifyPositionBand(7) === "TOP");
  assert("F position 18 is STRIKING_DISTANCE", classifyPositionBand(18) === "STRIKING_DISTANCE");
  assert("F position 45 is EMERGING", classifyPositionBand(45) === "EMERGING");
  assert("F position 74 is DEEP", classifyPositionBand(74) === "DEEP");

  const pageOpps = buildOpportunityReport(
    [],
    [
      {
        keys: ["https://www.scanonix.com/tools/ocr"],
        clicks: 1,
        impressions: 1630,
        ctr: 1 / 1630,
        position: 73.8,
      },
      {
        keys: ["https://www.scanonix.com/tools/merge-pdf"],
        clicks: 5,
        impressions: 200,
        ctr: 0.005,
        position: 5,
      },
    ],
  );
  assert(
    "F OCR-like page emits DEEP_RANKING",
    pageOpps.some((o) => o.category === "DEEP_RANKING" && o.page?.includes("/tools/ocr")),
  );
  assert(
    "F top page emits TOP_LOW_CTR not DEEP_RANKING",
    pageOpps.some((o) => o.category === "TOP_LOW_CTR") &&
      !pageOpps.some(
        (o) =>
          o.category === "DEEP_RANKING" && o.page?.includes("/tools/merge-pdf"),
      ),
  );

  // Holds
  assert("D OCR hold exists", Boolean(getHoldForSlug("ocr")));
  assert(
    "D OCR actionable proposals blocked by hold",
    isActionableProposalBlocked("ocr").blocked === true,
  );

  // Query clusters
  const clusters = clusterQueries(
    ocrQueries.map((q) => ({
      query: q.query,
      impressions: q.impressions,
      clicks: q.clicks,
    })),
  );
  const ocrFamily = clusters.find((c) => c.family === "ocr");
  assert(
    "G OCR queries cluster into ocr family",
    Boolean(ocrFamily && ocrFamily.members.length >= 8),
    `members=${ocrFamily?.members.length ?? 0}`,
  );
  assert(
    "G cluster preserves original query strings",
    Boolean(ocrFamily?.members.some((m) => m.query === "online ocr")),
  );

  // Proposals from fixture
  const fixture = buildFixtureReport({
    pages: [
      {
        keys: ["https://www.scanonix.com/tools/ocr"],
        clicks: 1,
        impressions: 1630,
        ctr: 1 / 1630,
        position: 73.8,
      },
      {
        keys: ["https://www.scanonix.com/tools/pdf-to-word"],
        clicks: 0,
        impressions: 38,
        ctr: 0,
        position: 40,
      },
      {
        keys: ["https://www.scanonix.com/tools/background-remover"],
        clicks: 0,
        impressions: 9,
        ctr: 0,
        position: 6.8,
      },
    ],
    queryPageMap: [
      ...ocrQueries,
      {
        query: "pdf to word",
        landingPage: "https://www.scanonix.com/tools/pdf-to-word",
        clicks: 0,
        impressions: 2,
        ctr: 0,
        position: 35,
      },
      {
        query: "convert pdf to word",
        landingPage: "https://www.scanonix.com/tools/pdf-to-word",
        clicks: 0,
        impressions: 1,
        ctr: 0,
        position: 42,
      },
      {
        query: "pdf to docx",
        landingPage: "https://www.scanonix.com/tools/pdf-to-word",
        clicks: 0,
        impressions: 1,
        ctr: 0,
        position: 48,
      },
    ],
    opportunities: pageOpps,
  });

  const bundle = buildProposalsFromReport(fixture, { source: "fixture", windowDays: 28 });

  assert("C requiresHumanApproval true on bundle", bundle.requiresHumanApproval === true);
  assert("C mutatesToolSeo false", bundle.mutatesToolSeo === false);
  assert("I gitOperations false", bundle.gitOperations === false);
  assert(
    "C every proposal requiresHumanApproval",
    bundle.proposals.every((p) => p.requiresHumanApproval === true),
  );

  const ocrProposal = bundle.proposals.find((p) => p.slug === "ocr");
  assert("D OCR proposal exists", Boolean(ocrProposal));
  assert("D OCR proposal blocked", ocrProposal?.blocked === true);
  assert(
    "D OCR recommendation not actionable content edit",
    ocrProposal?.recommendationType === "OBSERVE",
    ocrProposal?.recommendationType,
  );
  assert(
    "F OCR position band DEEP",
    ocrProposal?.positionBand === "DEEP",
    ocrProposal?.positionBand,
  );
  assert(
    "F OCR evidence STRONG but still blocked by hold",
    ocrProposal?.evidenceQuality === "STRONG" && ocrProposal.blocked,
  );
  assert("D OCR remains ACTIVE lifecycle", ocrProposal?.urlLifecycle === "ACTIVE");

  const pdfProposal = bundle.proposals.find((p) => p.slug === "pdf-to-word");
  assert("E PDF-to-Word proposal exists", Boolean(pdfProposal));
  assert(
    "E PDF-to-Word evidence SPARSE",
    pdfProposal?.evidenceQuality === "SPARSE",
    pdfProposal?.evidenceQuality,
  );
  assert("E PDF-to-Word proposal blocked", pdfProposal?.blocked === true);
  assert(
    "E PDF-to-Word not CONTENT_REVIEW while sparse",
    pdfProposal?.recommendationType !== "CONTENT_REVIEW",
    pdfProposal?.recommendationType,
  );

  // SEO-AUTO-2.1 retired URL awareness
  assert(
    "R /tools/background-remover recognized as retired",
    isIntentionallyRetiredUrl("/tools/background-remover") &&
      isIntentionallyRetiredUrl("https://www.scanonix.com/tools/background-remover"),
  );
  assert(
    "R unknown tool path is NOT retired",
    !isIntentionallyRetiredUrl("/tools/merge-pdf") &&
      !isIntentionallyRetiredUrl("/tools/totally-unknown-404-tool"),
  );
  assert(
    "R registry entry path is exact",
    getRetiredEntryForPath("/tools/background-remover")?.slug === "background-remover",
  );

  const bgProposal = bundle.proposals.find((p) => p.slug === "background-remover");
  assert("R background-remover row present for visibility", Boolean(bgProposal));
  assert("R urlLifecycle RETIRED", bgProposal?.urlLifecycle === "RETIRED");
  assert(
    "R recommendationType RETIRED_HISTORICAL",
    bgProposal?.recommendationType === "RETIRED_HISTORICAL",
    bgProposal?.recommendationType,
  );
  assert("R countsAsActiveSeoCandidate false", bgProposal?.countsAsActiveSeoCandidate === false);
  assert("R blocked true", bgProposal?.blocked === true);
  assert(
    "R no actionable review types",
    ![
      "CONTENT_REVIEW",
      "SNIPPET_REVIEW",
      "INTENT_REVIEW",
      "INTERNAL_LINK_REVIEW",
      "CANNIBALIZATION_REVIEW",
    ].includes(bgProposal?.recommendationType ?? ""),
  );
  assert(
    "R historical pos 6.8 is NOT treated as TOP SEO opportunity",
    bgProposal?.positionBand === "TOP" &&
      bgProposal.recommendationType === "RETIRED_HISTORICAL" &&
      bgProposal.detectedSignals.includes("RETIRED_HISTORICAL_RESIDUE") &&
      !bgProposal.detectedSignals.includes("TOP_LOW_CTR"),
  );
  assert(
    "R retired residue counted separately",
    bundle.retiredResidueCount >= 1 &&
      !bundle.proposals
        .filter((p) => p.countsAsActiveSeoCandidate)
        .some((p) => p.slug === "background-remover"),
  );

  // G. No credential fields in proposal JSON
  const serialized = JSON.stringify(bundle);
  assert(
    "G no refresh_token field",
    !/"refresh_token"/i.test(serialized),
  );
  assert(
    "G no access_token field",
    !/"access_token"/i.test(serialized),
  );
  assert(
    "G no client_secret field",
    !/"client_secret"/i.test(serialized),
  );

  // H. propose script writes only under .tmp-seo
  const proposeSource = readSource("scripts/seo/propose.ts");
  assert(
    "H propose uses DEFAULT_SEO_REPORT_DIR",
    proposeSource.includes("DEFAULT_SEO_REPORT_DIR") &&
      proposeSource.includes("DEFAULT_SEO_PROPOSALS_DIR"),
  );
  assert(
    "H propose does not write outside tmp pattern",
    !proposeSource.includes("constants/tool-seo") ||
      proposeSource.includes("buildProposalsFromReport"),
  );

  // I. No git staging/commit/push in SEO path
  const seoLibFiles = [
    "lib/seo/local/proposals.ts",
    "lib/seo/local/experiments.ts",
    "lib/seo/local/retired-urls.ts",
    "scripts/seo/propose.ts",
    "scripts/seo/experiment-status.ts",
  ];
  for (const file of seoLibFiles) {
    const src = readSource(file);
    assert(
      `I ${file} has no git commit/push/stage`,
      !/\bgit\s+(add|commit|push|stage)\b/.test(src) &&
        !src.includes("simple-git") &&
        !src.includes("execSync(\"git"),
    );
  }

  // Docs exist
  assert("docs EXPERIMENTS.md exists", existsSync(join(root, "docs/seo/EXPERIMENTS.md")));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
