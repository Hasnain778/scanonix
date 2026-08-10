export const dynamic = "force-dynamic";

import { MonitorsShell } from "@/components/monitors/MonitorsShell";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Security Monitors",
  description: "Continuously monitor websites and receive alerts when security changes.",
  path: "/monitors",
  noIndex: true,
});

export default async function MonitorsPage() {
  return (
    <AppPageLayout>
      <MonitorsShell />
    </AppPageLayout>
  );
}
