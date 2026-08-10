import { LoadingState } from "@/components/common/LoadingState";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";

export default function Loading() {
  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative min-h-screen px-4 pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <LoadingState
            title="Loading Scanonix…"
            description="Preparing your workspace."
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
