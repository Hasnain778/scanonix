export const dynamic = "force-dynamic";

import { ScanHistoryShell } from "@/components/scan-history/ScanHistoryShell";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Scan History",
  description: "Review and manage your previous Scanonix security scans.",
  path: "/scan-history",
  noIndex: true,
});

export default async function ScanHistoryPage() {
  await requireAuth();

  return (
    <AppPageLayout>
      <ScanHistoryShell />
    </AppPageLayout>
  );
}
