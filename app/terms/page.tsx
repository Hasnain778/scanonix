import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { ToolShell } from "@/components/tools/ToolShell";
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Terms of Service — Scanonix",
  description:
    "Read the Scanonix Terms of Service covering tool usage, user responsibilities, premium features, payments, disclaimers, and account terms.",
  keywords: [
    "Scanonix terms of service",
    "document tools terms",
    "online PDF tools terms",
    "Scanonix legal",
  ],
  openGraph: {
    title: "Terms of Service — Scanonix",
    description:
      "Terms governing your use of Scanonix websites, tools, and related services.",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <ToolShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <LegalDocumentLayout
          title="Terms of Service"
          description="These Terms govern access to and use of Scanonix websites, browser tools, mobile applications, and related services."
          lastUpdated={TERMS_LAST_UPDATED}
          sections={TERMS_SECTIONS}
        />
      </div>
    </ToolShell>
  );
}
