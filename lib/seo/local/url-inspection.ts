import type { searchconsole_v1 } from "googleapis";
import { URL_INSPECTION_DELAY_MS } from "@/lib/seo/local/constants";
import { sleep } from "@/lib/seo/local/date-utils";
import type { UrlInspectionFinding } from "@/lib/seo/local/types";

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseInspectionResult(
  url: string,
  tool: string | undefined,
  data: searchconsole_v1.Schema$InspectUrlIndexResponse | undefined,
): UrlInspectionFinding {
  const result = data?.inspectionResult;
  const indexStatus = result?.indexStatusResult;
  const verdict = pickString(indexStatus?.verdict);
  const coverageState = pickString(indexStatus?.coverageState);
  const indexingState = pickString(indexStatus?.indexingState);
  const robotsTxtState = pickString(indexStatus?.robotsTxtState);
  const pageFetchState = pickString(indexStatus?.pageFetchState);
  const lastCrawl = pickString(indexStatus?.lastCrawlTime);

  const googleCanonical = pickString(indexStatus?.googleCanonical);
  const userCanonical = pickString(indexStatus?.userCanonical);

  const mobileUsability =
    result?.mobileUsabilityResult?.verdict ??
    result?.mobileUsabilityResult?.issues?.length
      ? "issues_present"
      : undefined;

  const richResults =
    result?.richResultsResult?.verdict ??
    (result?.richResultsResult?.detectedItems?.length
      ? "items_detected"
      : undefined);

  const issueParts: string[] = [];
  if (verdict && verdict !== "PASS") issueParts.push(`verdict:${verdict}`);
  if (coverageState && coverageState !== "Submitted and indexed") {
    issueParts.push(`coverage:${coverageState}`);
  }
  if (pageFetchState && pageFetchState !== "SUCCESSFUL") {
    issueParts.push(`fetch:${pageFetchState}`);
  }

  return {
    url,
    tool,
    indexStatus: coverageState ?? verdict,
    googleCanonical,
    userCanonical,
    lastCrawl,
    robotsStatus: robotsTxtState,
    crawlAllowed: robotsTxtState ? robotsTxtState === "ALLOWED" : undefined,
    indexingState,
    mobileUsability: pickString(mobileUsability),
    richResults: pickString(richResults),
    issue: issueParts.length > 0 ? issueParts.join("; ") : undefined,
  };
}

export async function inspectUrl(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
  inspectionUrl: string,
  tool?: string,
): Promise<UrlInspectionFinding> {
  const response = await searchconsole.urlInspection.index.inspect({
    requestBody: {
      inspectionUrl,
      siteUrl,
    },
  });

  return parseInspectionResult(inspectionUrl, tool, response.data);
}

export async function inspectUrlsRateLimited(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
  urls: Array<{ url: string; tool?: string }>,
  delayMs = URL_INSPECTION_DELAY_MS,
): Promise<UrlInspectionFinding[]> {
  const findings: UrlInspectionFinding[] = [];

  for (let i = 0; i < urls.length; i += 1) {
    const { url, tool } = urls[i];
    try {
      findings.push(await inspectUrl(searchconsole, siteUrl, url, tool));
    } catch (error) {
      findings.push({
        url,
        tool,
        issue: error instanceof Error ? error.message : "Inspection failed",
      });
    }

    if (i < urls.length - 1) {
      await sleep(delayMs);
    }
  }

  return findings;
}
