export const dynamic = "force-dynamic";

import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Processing History",
  description: "View your Scanonix processing history.",
  path: "/history",
  noIndex: true,
});

export default async function HistoryPage() {
  await requireAuth();

  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative min-h-screen pt-24 pb-20 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <Link
              href="/dashboard"
              className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-scanonix-muted hover:text-scanonix-orange"
            >
              ← Back to dashboard
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Processing history
            </h1>
            <p className="mt-3 text-sm text-scanonix-muted">
              A record of your recent Scanonix tool activity.
            </p>
          </header>

          <EmptyState
            title="History not available yet"
            description="Processing history requires a backend connection. Once enabled, your recent conversions, OCR runs, and exports will appear here."
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <div className="mt-6 text-center">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-scanonix-orange hover:text-scanonix-orange-light"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
