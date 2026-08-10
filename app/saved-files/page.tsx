export const dynamic = "force-dynamic";

import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";
import { requireAuth } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Saved Files",
  description: "View your saved Scanonix files.",
  path: "/saved-files",
  noIndex: true,
});

export default async function SavedFilesPage() {
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
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Saved files
            </h1>
            <p className="mt-3 text-sm text-scanonix-muted">
              Files saved to your Scanonix cloud workspace.
            </p>
          </header>

          <EmptyState
            title="Cloud storage not connected"
            description="Saved files require Supabase Storage to be configured. Once enabled, documents you choose to save will appear here."
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
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
