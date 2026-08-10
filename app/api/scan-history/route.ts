import { NextResponse } from "next/server";
import { listScanHistory } from "@/lib/scan-history/server";
import type {
  ScanDateFilter,
  ScanRiskFilter,
  ScanSortOption,
  ScanTypeFilter,
} from "@/lib/scan-history/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await listScanHistory({
    page: Number(searchParams.get("page") ?? "1"),
    limit: Number(searchParams.get("limit") ?? "20"),
    search: searchParams.get("search") ?? undefined,
    risk: (searchParams.get("risk") as ScanRiskFilter | null) ?? "all",
    type: (searchParams.get("type") as ScanTypeFilter | null) ?? "all",
    date: (searchParams.get("date") as ScanDateFilter | null) ?? "all",
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sort: (searchParams.get("sort") as ScanSortOption | null) ?? "newest",
  });

  if ("error" in result) {
    if (result.error === "unauthorized") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json(
      { error: result.message ?? "Could not load scan history." },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
