"use client";

import { useId, useMemo, useState } from "react";
import { ToolCard } from "@/components/tools/directory/ToolCard";
import { ToolsEmptyState } from "@/components/tools/directory/ToolsEmptyState";
import {
  filterTools,
  getFeaturedTools,
  SCANONIX_TOOLS,
  TOOL_CATEGORY_FILTERS,
  type ToolCategoryFilterId,
} from "@/lib/tools-directory";

export function ToolsDirectory() {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategoryFilterId>("all");

  const featuredTools = useMemo(() => getFeaturedTools(), []);
  const filteredTools = useMemo(
    () => filterTools(SCANONIX_TOOLS, query, category),
    [query, category],
  );

  const activeCategoryLabel =
    TOOL_CATEGORY_FILTERS.find((item) => item.id === category)?.label ?? "All";

  const showFeatured = category === "all" && !query.trim();
  const gridTools = showFeatured
    ? filteredTools.filter((tool) => !tool.featured)
    : filteredTools;

  const handleClearFilters = () => {
    setQuery("");
    setCategory("all");
  };

  return (
    <div className="space-y-12 sm:space-y-16">
      <header className="max-w-3xl">
        <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-scanonix-orange">
          <span className="h-px w-6 bg-scanonix-orange/60" />
          Scanonix Workspace
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          All Scanonix Tools
        </h1>
        <p className="mt-5 text-base leading-relaxed text-scanonix-muted sm:text-lg">
          Scan, convert, organise, and understand your documents — every live
          tool in one premium directory. Process files locally in your browser
          whenever possible.
        </p>
      </header>

      <div className="space-y-4">
        <label htmlFor={searchId} className="sr-only">
          Search tools
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-scanonix-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools..."
            className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-12 pr-4 text-base text-white placeholder:text-scanonix-muted/70 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter tools by category"
          className="flex flex-wrap gap-2"
        >
          {TOOL_CATEGORY_FILTERS.map((item) => {
            const isActive = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(item.id)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 ${
                  isActive
                    ? "border-scanonix-orange bg-scanonix-orange/15 text-white shadow-sm shadow-scanonix-orange/20"
                    : "border-white/10 bg-black/20 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {showFeatured && (
        <section aria-labelledby="featured-tools-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-scanonix-orange">
                Popular Tools
              </p>
              <h2
                id="featured-tools-heading"
                className="mt-2 text-2xl font-bold text-white sm:text-3xl"
              >
                Start with the essentials
              </h2>
            </div>
            <p className="hidden text-sm text-scanonix-muted sm:block">
              {featuredTools.length} featured
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} featured />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-tools-heading">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="all-tools-heading" className="text-2xl font-bold text-white">
              {showFeatured ? "All tools" : `${activeCategoryLabel} tools`}
            </h2>
            <p className="mt-1 text-sm text-scanonix-muted">
              {gridTools.length} tool{gridTools.length === 1 ? "" : "s"}{" "}
              available
            </p>
          </div>
        </div>

        {gridTools.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gridTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        ) : (
          <ToolsEmptyState
            query={query}
            categoryLabel={activeCategoryLabel}
            onClear={handleClearFilters}
          />
        )}
      </section>
    </div>
  );
}
