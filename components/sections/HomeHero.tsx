import Link from "next/link";
import { ToolSearch } from "@/components/home/ToolSearch";
import { HeroFloatingIcons } from "@/components/home/HeroFloatingIcons";
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
      className="home-hero relative overflow-hidden border-b border-white/8 pt-[calc(4.5rem+2rem)] pb-12 sm:pt-[calc(5rem+3rem)] sm:pb-16"
    >
      <div className="home-hero-mesh pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
      <div className="home-hero-glow pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" />
      <HeroParallaxGlow />
      <HeroFloatingIcons />

      <div className="page-container relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="home-hero-heading text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Free online PDF, image &amp; document tools
          </h1>

          <p className="home-hero-subcopy mx-auto mt-4 max-w-2xl text-base leading-relaxed text-scanonix-muted sm:mt-5 sm:text-lg">
            Merge, compress, convert, OCR, translate and edit files in your browser — fast, private and free to start.
          </p>

          <div className="home-hero-cta-wrap mt-6 sm:mt-8">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <Link
                href="/tools"
                className="home-btn-interactive inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-scanonix-orange px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-scanonix-orange-light sm:w-auto sm:min-w-[11.25rem]"
              >
                Use Tools Online
              </Link>
              <PlayStoreLink
                location="hero"
                markSize={20}
                className="home-btn-interactive min-h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-6 py-2.5 text-sm font-semibold text-white transition-[border-color,box-shadow] hover:border-scanonix-orange/40 hover:shadow-[0_0_0_1px_rgba(255,106,0,0.25)] sm:w-auto sm:min-w-[12.5rem]"
              >
                Get the Android App
              </PlayStoreLink>
            </div>
            <p className="mt-3 text-center text-xs text-scanonix-muted">Available on Android</p>
          </div>

          <div className="home-hero-search-wrap mt-6 sm:mt-8">
            <ToolSearch suggestions={suggestions} />
          </div>
        </div>
      </div>
    </section>
  );
}
