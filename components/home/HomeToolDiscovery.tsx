"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { HomeCategoryNav, type HomeCategoryFilter } from "@/components/home/HomeCategoryNav";
import { HomeToolCard } from "@/components/home/HomeToolCard";
import {
  HOMEPAGE_CATEGORY_META,
  POPULAR_TOOL_IDS,
  type HomepageTool,
} from "@/constants/homepage-tools";

interface HomeToolDiscoveryProps {
  tools: HomepageTool[];
}

export function HomeToolDiscovery({ tools }: HomeToolDiscoveryProps) {
  const [activeCategory, setActiveCategory] = useState<HomeCategoryFilter>("all");

  const filteredTools = useMemo(() => {
    if (activeCategory === "all") return tools;
    return tools.filter((tool) => tool.category === activeCategory);
  }, [activeCategory, tools]);

  const categoryMeta =
    activeCategory === "all" ? null : HOMEPAGE_CATEGORY_META[activeCategory];

  return (
    <section id="popular-tools" className="pb-10 pt-3 sm:pb-12 sm:pt-5">
      <div className="page-container">
        <HomeCategoryNav
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        <div className="mt-3 flex items-center justify-between gap-3 sm:mt-6 sm:items-end">
          <h2 className="text-section-title min-w-0 text-lg sm:text-2xl">
            {activeCategory === "all" ? "Popular tools" : `${categoryMeta?.label} tools`}
          </h2>
          <Link
            href={activeCategory === "all" ? "/tools" : categoryMeta?.viewAllHref ?? "/tools"}
            className="inline-flex shrink-0 items-center gap-1 py-1 text-sm font-semibold text-scanonix-orange transition-colors hover:text-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
          >
            Browse all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-1.5 hidden text-sm text-body-bright sm:block">
          {activeCategory === "all"
            ? "Start with the most-used tools."
            : categoryMeta?.description}
        </p>

        {filteredTools.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {filteredTools.map((tool) => (
              <HomeToolCard
                key={tool.id}
                toolId={tool.id}
                name={tool.name}
                shortDescription={tool.shortDescription}
                href={tool.href}
                icon={tool.icon}
                category={tool.category}
                popular={(POPULAR_TOOL_IDS as readonly string[]).includes(tool.id)}
                compactMobile
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-8 text-center sm:mt-6">
            <p className="text-sm text-body-bright">
              No popular {categoryMeta?.label.toLowerCase()} tools in this row.
            </p>
            <Link
              href={categoryMeta?.viewAllHref ?? "/tools"}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-scanonix-orange transition-colors hover:text-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
            >
              Browse {categoryMeta?.heading ?? "all tools"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

      </div>
    </section>
  );
}
