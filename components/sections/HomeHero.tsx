import { ToolSearch } from "@/components/home/ToolSearch";
import { HeroParallaxGlow } from "@/components/home/HeroParallaxGlow";

export function HomeHero() {
  return (
    <section
      id="home"
      className="home-hero relative overflow-hidden border-b border-white/8 pt-[calc(4rem+0.5rem)] pb-3 sm:pt-[calc(4.5rem+1rem)] sm:pb-5"
    >
      <div className="home-hero-mesh pointer-events-none absolute inset-0 z-0 opacity-80" aria-hidden="true" />
      <div className="home-hero-glow pointer-events-none absolute inset-0 z-[1] opacity-70" aria-hidden="true" />
      <HeroParallaxGlow />

      <div className="page-container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="home-hero-heading text-balance text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl lg:text-[2.125rem]">
            Free online PDF, image &amp; document tools
          </h1>

          <p className="home-hero-subcopy mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-scanonix-muted sm:mt-2 sm:text-sm">
            Merge, compress, convert, OCR, and edit files in your browser — fast and free to start.
          </p>

          <div className="home-hero-search-wrap mt-3 sm:mt-5">
            <ToolSearch showSuggestions={false} />
          </div>
        </div>
      </div>
    </section>
  );
}
