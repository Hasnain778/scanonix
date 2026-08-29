import Link from "next/link";
import { ArrowRight, FileText, ImageIcon, Shield, Sparkles } from "lucide-react";
import { HomeToolCard } from "@/components/home/HomeToolCard";
import {
  getPopularTools,
  HOMEPAGE_CATEGORY_GRIDS,
  HOMEPAGE_CATEGORY_META,
  POPULAR_TOOL_IDS,
  type HomepageToolCategory,
} from "@/constants/homepage-tools";
import { getImageToolsHubHref } from "@/lib/navigation/category-hub-urls";

const CATEGORY_ICONS: Record<HomepageToolCategory, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  ai: Sparkles,
  security: Shield,
};

export function PopularToolsSection() {
  const tools = getPopularTools();

  return (
    <section id="popular-tools" className="border-t border-border py-12 sm:py-14">
      <div className="page-container">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-section-title text-2xl sm:text-3xl">Popular tools</h2>
            <p className="mt-2 text-sm text-body-bright sm:text-base">
              The most-used tools to get started quickly.
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-scanonix-orange transition-colors hover:text-scanonix-orange-light"
          >
            Browse all tools
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <HomeToolCard
              key={tool.id}
              toolId={tool.id}
              name={tool.name}
              shortDescription={tool.shortDescription}
              href={tool.href}
              icon={tool.icon}
              category={tool.category}
              popular={(POPULAR_TOOL_IDS as readonly string[]).includes(tool.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryDiscoveryCard({ category }: { category: HomepageToolCategory }) {
  const meta = HOMEPAGE_CATEGORY_META[category];
  const toolCount = HOMEPAGE_CATEGORY_GRIDS[category].filter((tool) => !tool.comingSoon).length;
  const Icon = CATEGORY_ICONS[category];
  const cardHref = category === "image" ? getImageToolsHubHref() : meta.viewAllHref;

  return (
    <Link
      id={meta.anchor}
      href={cardHref}
      className="category-discovery-card group scroll-mt-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
    >
      <span className="category-discovery-card__icon">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-base font-semibold text-foreground">{meta.heading}</span>
        <span className="mt-1.5 block text-sm leading-relaxed text-body-bright">
          {meta.description}
        </span>
      </span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
        <span className="text-body-bright">
          {toolCount} tool{toolCount === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-scanonix-orange">
          {category === "image" ? "Explore hub" : "Explore"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

export function ToolCategoriesSection() {
  const categories: HomepageToolCategory[] = ["pdf", "image", "ai", "security"];

  return (
    <section id="browse-categories" className="border-t border-border bg-surface-muted/40 py-12 sm:py-14">
      <div className="page-container">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-section-title text-2xl sm:text-3xl">Browse by category</h2>
            <p className="mt-2 max-w-2xl text-sm text-body-bright sm:text-base">
              Jump straight into PDF, image, AI, or security tools.
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-scanonix-orange transition-colors hover:text-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
          >
            View all tools
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryDiscoveryCard key={category} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}
