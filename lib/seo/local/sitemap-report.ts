import type { searchconsole_v1 } from "googleapis";
import { SEO_CANONICAL_ORIGIN, SEO_SITEMAP_URL } from "@/lib/seo/local/constants";
import type { SitemapComparison } from "@/lib/seo/local/types";

function countSitemapUrls(xml: string): number {
  return (xml.match(/<loc>/gi) ?? []).length;
}

function extractLastMod(xml: string): string | undefined {
  const match = xml.match(/<lastmod>([^<]+)<\/lastmod>/i);
  return match?.[1];
}

export async function fetchProductionSitemap(): Promise<{
  urlCount: number;
  lastModified?: string;
}> {
  const response = await fetch(SEO_SITEMAP_URL, {
    headers: { "User-Agent": "Scanonix-SEO-Local/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Production sitemap fetch failed: HTTP ${response.status}`);
  }

  const xml = await response.text();
  return {
    urlCount: countSitemapUrls(xml),
    lastModified: extractLastMod(xml),
  };
}

export async function fetchGscSitemapStatus(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
): Promise<SitemapComparison> {
  const notes: string[] = [];
  let gscEntry: searchconsole_v1.Schema$WmxSitemap | undefined;

  try {
    const response = await searchconsole.sitemaps.list({ siteUrl });
    const entries = response.data.sitemap ?? [];

    gscEntry =
      entries.find((entry) => entry.path === SEO_SITEMAP_URL) ??
      entries.find((entry) => entry.path?.includes("sitemap.xml")) ??
      entries[0];

    if (!entries.length) {
      notes.push("No sitemaps listed in Search Console — read-only check only.");
    } else if (!entries.some((entry) => entry.path === SEO_SITEMAP_URL)) {
      notes.push(
        `Production sitemap ${SEO_SITEMAP_URL} not found in GSC list — may use different submission path.`,
      );
    }
  } catch (error) {
    notes.push(
      error instanceof Error
        ? `GSC sitemap list error: ${error.message}`
        : "GSC sitemap list failed.",
    );
  }

  let productionUrlCount: number | undefined;
  let productionLastModified: string | undefined;

  try {
    const production = await fetchProductionSitemap();
    productionUrlCount = production.urlCount;
    productionLastModified = production.lastModified;
  } catch (error) {
    notes.push(
      error instanceof Error
        ? `Production sitemap fetch: ${error.message}`
        : "Production sitemap fetch failed.",
    );
  }

  return {
    gscPath: gscEntry?.path ?? undefined,
    gscSubmitted: Boolean(gscEntry),
    gscLastDownloaded: gscEntry?.lastDownloaded ?? undefined,
    gscErrors:
      gscEntry?.errors != null ? Number(gscEntry.errors) : undefined,
    gscWarnings:
      gscEntry?.warnings != null ? Number(gscEntry.warnings) : undefined,
    gscPending: gscEntry?.isPending ?? undefined,
    productionUrlCount,
    productionLastModified,
    notes,
  };
}

export function formatSitemapSummary(comparison: SitemapComparison): string[] {
  const lines: string[] = [];
  lines.push(`Production sitemap: ${SEO_SITEMAP_URL}`);
  if (comparison.productionUrlCount !== undefined) {
    lines.push(`Production URL count: ${comparison.productionUrlCount}`);
  }
  if (comparison.gscPath) {
    lines.push(`GSC sitemap path: ${comparison.gscPath}`);
    lines.push(`GSC submitted: ${comparison.gscSubmitted ? "yes" : "no"}`);
    if (comparison.gscLastDownloaded) {
      lines.push(`GSC last downloaded: ${comparison.gscLastDownloaded}`);
    }
    lines.push(`GSC errors: ${comparison.gscErrors ?? 0}`);
    lines.push(`GSC warnings: ${comparison.gscWarnings ?? 0}`);
  }
  for (const note of comparison.notes) {
    lines.push(`Note: ${note}`);
  }
  lines.push(`Canonical origin reference: ${SEO_CANONICAL_ORIGIN}`);
  return lines;
}
