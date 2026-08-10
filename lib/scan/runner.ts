import { runWebsiteIntelligenceScan } from "@/lib/scan/website/engine";
import type { RunWebsiteScanInput } from "@/lib/scan/types";
import type { ScanReport } from "@/lib/scan-report/types";

export async function runWebsiteScan(input: RunWebsiteScanInput): Promise<ScanReport> {
  return runWebsiteIntelligenceScan(input);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
