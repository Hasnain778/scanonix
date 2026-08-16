import Link from "next/link";
import { ToolSearch } from "@/components/home/ToolSearch";
import { HeroParallaxGlow } from "@/components/home/HeroParallaxGlow";
import { PlayStoreLink } from "@/components/marketing/PlayStoreLink";
import { getToolById, HERO_QUICK_SUGGESTIONS } from "@/constants/homepage-tools";

const suggestions = HERO_QUICK_SUGGESTIONS.map((id) => {
  const tool = getToolById(id)!;
  return { id: tool.id, name: tool.name, href: tool.href };
});

export function HomeHero() {
  return (
    <section
      id="home"
      className="home-hero relative overflow-hidden border-b border-white/8 pt-[calc(4rem+1.75rem)] pb-10 sm:pt-[calc(4.5rem+2.25rem)] sm:pb-12"
    >
      <div className="home-hero-mesh pointer-events-none absolute inset-0 z-0 opacity-80" aria-hidden="true" />
      <div className="home-hero-glow pointer-events-none absolute inset-0 z-[1] opacity-70" aria-hidden="true" />
      <HeroParallaxGlow />

      <div className="page-container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="home-hero-heading text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
            Free online PDF, image &amp; document tools
          </h1>

          <p className="home-hero-subcopy mx-auto mt-3 max-w-xl text-sm leading-relaxed text-scanonix-muted sm:mt-4 sm:text-base">
            Merge, compress, convert, OCR, translate and edit files in your browser — fast, private and free to start.
          </p>

          <div className="home-hero-search-wrap mt-6 sm:mt-7">
            <ToolSearch suggestions={suggestions} />
          </div>

          <div className="home-hero-cta-wrap mt-6 sm:mt-7">
            <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
              <Link
                href="/tools"
                className="btn-primary inline-flex w-full sm:w-auto sm:min-w-[10.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
              >
                Use Tools Online
              </Link>
              <PlayStoreLink
                location="hero"
                markSize={18}
                className="btn-secondary inline-flex w-full sm:w-auto sm:min-w-[11.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
              >
                Get the Android App
              </PlayStoreLink>
            </div>
            <p className="mt-2.5 text-center text-xs text-scanonix-muted">Available on Android</p>
          </div>
        </div>
      </div>
    </section>
  );
}
