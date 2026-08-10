export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";
import { requireAdmin } from "@/lib/auth/admin";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Admin",
  description: "Scanonix platform administration.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative min-h-screen pt-24 pb-20 sm:pt-28 sm:pb-24">
        <Suspense fallback={<div className="page-container text-scanonix-muted">Loading…</div>}>
          {children}
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
