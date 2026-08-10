import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeToolCard } from "@/components/home/HomeToolCard";
import {
  getPopularTools,
  HOMEPAGE_CATEGORY_GRIDS,
  HOMEPAGE_CATEGORY_META,
  type HomepageToolCategory,
} from "@/constants/homepage-tools";

export function PopularToolsSection() {
  const tools = getPopularTools();

  return (
    <section id="popular-tools" className="border-t border-white/8 py-14 sm:py-16">
      <div className="page-container">
        <div className="mb-10 flex items-end justify-between gap-4 sm:mb-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Popular tools</h2>
            <p className="mt-3 text-sm text-scanonix-muted sm:text-base">
              The most-used tools to get started quickly.
            </p>
          </div>
          <Link
            href="/tools"
            className="hidden items-center gap-1 text-sm font-medium text-scanonix-orange hover:underline sm:inline-flex"
          >
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {tools.map((tool) => (
            <HomeToolCard
              key={tool.id}
              name={tool.name}
              shortDescription={tool.shortDescription}
              href={tool.href}
              icon={tool.icon}
              category={tool.category}
              premium
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryBlock({ category }: { category: HomepageToolCategory }) {
  const meta = HOMEPAGE_CATEGORY_META[category];
  const tools = HOMEPAGE_CATEGORY_GRIDS[category];

  return (
    <section id={meta.anchor} className="border-t border-white/8 py-14 sm:py-16">
      <div className="page-container">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{meta.heading}</h2>
            <p className="mt-2 max-w-2xl text-sm text-scanonix-muted sm:text-base">{meta.description}</p>
          </div>
          <Link
            href={meta.viewAllHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-scanonix-orange hover:underline"
          >
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <HomeToolCard
              key={tool.id}
              name={tool.name}
              shortDescription={tool.shortDescription}
              href={tool.href}
              icon={tool.icon}
              category={category}
              comingSoon={tool.comingSoon}
              proOnly={tool.proOnly}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ToolCategoriesSection() {
  const categories: HomepageToolCategory[] = ["pdf", "image", "ai", "security"];

  return (
    <>
      {categories.map((category) => (
        <CategoryBlock key={category} category={category} />
      ))}
    </>
  );
}
