export const dynamic = "force-dynamic";

import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Scan Results",
  description: "Premium cybersecurity scan report with risk scoring, threats, and AI recommendations.",
  path: "/scan-results",
  noIndex: true,
});

export default async function ScanResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return <AppPageLayout>{children}</AppPageLayout>;
}
