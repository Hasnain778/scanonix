import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { ToolShell } from "@/components/tools/ToolShell";
import {
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTIONS,
} from "@/lib/legal/content";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Privacy Policy — Scanonix",
  description:
    "Learn how Scanonix handles your data, including local browser processing for PDF and image tools, cookies, analytics, account information, and your privacy rights.",
  path: "/privacy",
  keywords: [
    "Scanonix privacy policy",
    "local browser processing",
    "document tools privacy",
    "data protection",
    "OCR privacy",
  ],
});

export default function PrivacyPage() {
  return (
    <ToolShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <LegalDocumentLayout
          title="Privacy Policy"
          description="This policy explains how Scanonix collects, uses, stores, and protects information when you use our website, tools, and related services."
          lastUpdated={PRIVACY_LAST_UPDATED}
          sections={PRIVACY_SECTIONS}
        />
      </div>
    </ToolShell>
  );
}
