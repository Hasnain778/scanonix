import type { searchconsole_v1 } from "googleapis";
import { formatISO, subDays } from "./date-utils";
import { SEARCH_ANALYTICS_ROW_LIMIT } from "@/lib/seo/local/constants";
import type {
  DateRangeSpec,
  SearchAnalyticsRow,
  SearchAnalyticsSummary,
} from "@/lib/seo/local/types";

export function buildDateRanges(referenceDate = new Date()): {
  last7: DateRangeSpec;
  previous7: DateRangeSpec;
  last28: DateRangeSpec;
} {
  const end = subDays(referenceDate, 3);
  const last7Start = subDays(end, 6);
  const prev7End = subDays(last7Start, 1);
  const prev7Start = subDays(prev7End, 6);
  const last28Start = subDays(end, 27);

  return {
    last7: {
      label: "last_7_days",
      startDate: formatISO(last7Start),
      endDate: formatISO(end),
    },
    previous7: {
      label: "previous_7_days",
      startDate: formatISO(prev7Start),
      endDate: formatISO(prev7End),
    },
    last28: {
      label: "last_28_days",
      startDate: formatISO(last28Start),
      endDate: formatISO(end),
    },
  };
}

function mapRows(
  rows: searchconsole_v1.Schema$ApiDataRow[] | undefined,
): SearchAnalyticsRow[] {
  return (rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

function summarizeRows(rows: SearchAnalyticsRow[]): SearchAnalyticsSummary {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : 0,
    rowCount: rows.length,
  };
}

export async function querySearchAnalytics(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
  range: DateRangeSpec,
  dimensions: string[],
  rowLimit = SEARCH_ANALYTICS_ROW_LIMIT,
): Promise<SearchAnalyticsRow[]> {
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions,
      rowLimit,
    },
  });

  return mapRows(response.data.rows);
}

export async function fetchBaselineReport(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
) {
  const ranges = buildDateRanges();
  const [queryRows, pageRows] = await Promise.all([
    querySearchAnalytics(searchconsole, siteUrl, ranges.last28, ["query"]),
    querySearchAnalytics(searchconsole, siteUrl, ranges.last28, ["page"]),
  ]);

  const summary = summarizeRows(queryRows);

  return {
    period: `${ranges.last28.startDate} → ${ranges.last28.endDate}`,
    ...summary,
    topQueries: [...queryRows]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 15),
    topPages: [...pageRows]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 15),
  };
}

export async function fetch7DayComparison(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
) {
  const ranges = buildDateRanges();
  const [currentRows, previousRows] = await Promise.all([
    querySearchAnalytics(searchconsole, siteUrl, ranges.last7, ["query"]),
    querySearchAnalytics(searchconsole, siteUrl, ranges.previous7, ["query"]),
  ]);

  return {
    label: `${ranges.last7.startDate}→${ranges.last7.endDate} vs ${ranges.previous7.startDate}→${ranges.previous7.endDate}`,
    current: summarizeRows(currentRows),
    previous: summarizeRows(previousRows),
  };
}

export async function fetchQueryPageMap(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
) {
  const ranges = buildDateRanges();
  const rows = await querySearchAnalytics(
    searchconsole,
    siteUrl,
    ranges.last28,
    ["query", "page"],
  );

  return rows
    .map((row) => ({
      query: row.keys[0] ?? "",
      landingPage: row.keys[1] ?? "",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }))
    .filter((row) => row.query && row.landingPage)
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
}

export async function fetchDimensionBreakdown(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
  dimension: "country" | "device",
) {
  const ranges = buildDateRanges();
  return querySearchAnalytics(searchconsole, siteUrl, ranges.last28, [dimension]);
}
