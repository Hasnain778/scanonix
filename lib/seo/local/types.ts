/** Local SEO tooling types — scripts only, not bundled into Next.js client. */

export type SetupStatus = "CONNECTED" | "HUMAN_SETUP_REQUIRED" | "FAIL";

export interface HumanSetupRequired {
  status: "HUMAN_SETUP_REQUIRED";
  reason: string;
  steps: string[];
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rowCount: number;
}

export interface DateRangeSpec {
  label: string;
  startDate: string;
  endDate: string;
}

export interface OpportunityItem {
  category: string;
  signal: "EARLY_SIGNAL" | "ACTION_CANDIDATE";
  query?: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  note: string;
}

export interface QueryLandingMapRow {
  query: string;
  landingPage: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface CannibalizationCandidate {
  query: string;
  signal: "EARLY_SIGNAL" | "REVIEW_CANDIDATE";
  pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  note: string;
}

export interface UrlInspectionFinding {
  url: string;
  tool?: string;
  indexStatus?: string;
  googleCanonical?: string;
  userCanonical?: string;
  lastCrawl?: string;
  robotsStatus?: string;
  crawlAllowed?: boolean;
  indexingState?: string;
  mobileUsability?: string;
  richResults?: string;
  issue?: string;
}

export interface SitemapComparison {
  gscPath?: string;
  gscSubmitted?: boolean;
  gscLastDownloaded?: string;
  gscErrors?: number;
  gscWarnings?: number;
  gscPending?: boolean;
  productionUrlCount?: number;
  productionLastModified?: string;
  notes: string[];
}

export interface SeoReportPayload {
  generatedAt: string;
  status: SetupStatus;
  property?: string;
  propertySanitized?: string;
  oauthScope: string;
  writeAccessRequested: false;
  baseline?: {
    period: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    topQueries: SearchAnalyticsRow[];
    topPages: SearchAnalyticsRow[];
  };
  comparison7d?: {
    current: SearchAnalyticsSummary;
    previous: SearchAnalyticsSummary;
    label: string;
  };
  opportunities: OpportunityItem[];
  queryLandingMap: QueryLandingMapRow[];
  cannibalization: CannibalizationCandidate[];
  sitemap: SitemapComparison;
  indexingFindings: UrlInspectionFinding[];
  humanSetup?: HumanSetupRequired;
}
