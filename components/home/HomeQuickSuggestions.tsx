import Link from "next/link";
import { getToolById, HERO_QUICK_SUGGESTIONS } from "@/constants/homepage-tools";

const suggestions = HERO_QUICK_SUGGESTIONS.map((id) => {
  const tool = getToolById(id)!;
  return { id: tool.id, name: tool.name, href: tool.href };
});

export function HomeQuickSuggestions() {
  return (
    <section
      id="quick-suggestions"
      className="border-t border-white/8 py-8 sm:py-10"
      aria-labelledby="quick-suggestions-heading"
    >
      <div className="page-container">
        <h2 id="quick-suggestions-heading" className="text-sm font-medium text-scanonix-muted">
          Popular searches
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="home-hero-chip rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-scanonix-orange/30 hover:bg-scanonix-orange/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 sm:text-sm"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
