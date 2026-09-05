import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageBackground } from "@/components/ui/PageBackground";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <>
      <PageBackground />
      <Navbar />
      <main className="relative flex min-h-screen items-center justify-center px-4 pt-24 pb-20">
        <div className="max-w-lg text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-scanonix-orange">
            404
          </p>
          <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
            Page not found
          </h1>
          <p className="mt-4 text-base leading-relaxed text-scanonix-muted">
            The page you are looking for does not exist or may have moved.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/">Back to home</Button>
            <Button href="/tools" variant="outline">
              Browse tools
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
