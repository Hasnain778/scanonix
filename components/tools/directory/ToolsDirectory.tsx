"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo, useState } from "react";
import { ToolCard } from "@/components/tools/directory/ToolCard";
import { ToolsEmptyState } from "@/components/tools/directory/ToolsEmptyState";
import {
  getActivePdfSubcategoryFilter,
  getCategoryFilterLabel,
  isPdfCategoryFilter,
  PDF_SUBCATEGORY_FILTERS,
} from "@/constants/tool-categories";
import {
  filterTools,
  getCategoryCounts,
  getFeaturedTools,
  SCANONIX_TOOLS,
  TOOL_CATEGORY_FILTERS,
  type ToolCategoryFilterId,
} from "@/lib/tools-directory";
import {
  getToolsCategoryHref,
  parseToolsCategoryParam,
} from "@/lib/navigation/tool-category-urls";

export function ToolsDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();
  const [query, setQuery] = useState("");

  const category = parseToolsCategoryParam(searchParams.get("category"));
  const showPdfSubfilters = isPdfCategoryFilter(category);
  const activePdfSubcategory = getActivePdfSubcategoryFilter(category);

  const categoryCounts = useMemo(() => getCategoryCounts(), []);
  const featuredTools = useMemo(() => getFeaturedTools(), []);
  const filteredTools = useMemo(
    () => filterTools(SCANONIX_TOOLS, query, category),
    [query, category],
  );

  const activeCategoryLabel = getCategoryFilterLabel(category);

  const showFeatured = category === "all" && !query.trim();
  const gridTools = showFeatured
    ? filteredTools.filter((tool) => !tool.featured)
    : filteredTools;

  const setCategory = useCallback(
    (next: ToolCategoryFilterId) => {
      router.push(getToolsCategoryHref(next), { scroll: false });
    },
    [router],
  );

  const handleClearFilters = () => {
    setQuery("");
    router.push(getToolsCategoryHref("all"), { scroll: false });
  };

  const topLevelActive = (id: ToolCategoryFilterId) => {
    if (id === "pdf") return isPdfCategoryFilter(category);
    return category === id;
  };

  return (
    <div className="tools-directory-page space-y-8 sm:space-y-10">
      <div className="tools-directory-hero-zone">
        {/* Layer 1 — background light trails */}
        <div className="tools-directory-light-trails" aria-hidden="true">
          <svg
            className="tools-light-trail-svg"
            viewBox="0 0 1200 280"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter id="tools-trail-glow" x="-20%" y="-200%" width="140%" height="500%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="tools-trail-gradient-left" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,106,0,0)" />
                <stop offset="8%" stopColor="rgba(255,106,0,0.55)" />
                <stop offset="16%" stopColor="rgba(255,180,100,0.9)" />
                <stop offset="24%" stopColor="rgba(255,133,51,0.45)" />
                <stop offset="34%" stopColor="rgba(255,106,0,0.06)" />
                <stop offset="100%" stopColor="rgba(255,106,0,0)" />
              </linearGradient>
              <linearGradient id="tools-trail-gradient-right" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,106,0,0)" />
                <stop offset="8%" stopColor="rgba(255,106,0,0.5)" />
                <stop offset="16%" stopColor="rgba(255,160,90,0.85)" />
                <stop offset="24%" stopColor="rgba(255,122,69,0.4)" />
                <stop offset="34%" stopColor="rgba(255,106,0,0.05)" />
                <stop offset="100%" stopColor="rgba(255,106,0,0)" />
              </linearGradient>
              <linearGradient id="tools-trail-gradient-left-low" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,106,0,0)" />
                <stop offset="10%" stopColor="rgba(255,106,0,0.35)" />
                <stop offset="20%" stopColor="rgba(255,143,90,0.55)" />
                <stop offset="30%" stopColor="rgba(255,106,0,0.08)" />
                <stop offset="100%" stopColor="rgba(255,106,0,0)" />
              </linearGradient>
              <radialGradient id="tools-trail-flare-gradient">
                <stop offset="0%" stopColor="rgba(255,200,140,0.85)" />
                <stop offset="100%" stopColor="rgba(255,106,0,0)" />
              </radialGradient>
            </defs>
            <path
              className="tools-light-trail-path tools-light-trail-path--left"
              d="M-60,52 Q140,18 320,62 Q420,88 480,120"
            />
            <path
              className="tools-light-trail-path tools-light-trail-path--right"
              d="M1260,78 Q1080,42 900,72 Q780,98 720,128"
            />
            <path
              className="tools-light-trail-path tools-light-trail-path--left-low"
              d="M-40,168 Q160,148 340,178 Q400,192 440,210"
            />
            <circle
              className="tools-light-trail-flare"
              cx="148"
              cy="52"
              r="3.5"
              fill="url(#tools-trail-flare-gradient)"
            />
            <circle
              className="tools-light-trail-flare tools-light-trail-flare--2"
              cx="1052"
              cy="78"
              r="3"
              fill="url(#tools-trail-flare-gradient)"
            />
            <circle
              className="tools-light-trail-flare tools-light-trail-flare--3"
              cx="180"
              cy="168"
              r="2.5"
              fill="url(#tools-trail-flare-gradient)"
            />
          </svg>
        </div>

        {/* Layer 2 — ambient glow */}
        <div className="tools-directory-ambient-glow" aria-hidden="true" />

        {/* Layer 3 — hero content backplate + text */}
        <header className="tools-directory-hero tools-directory-header">
          <div className="tools-hero-content-backplate" aria-hidden="true" />
          <h1 className="text-page-title tools-hero-title">All Tools</h1>
          <p className="text-page-description">
            36 powerful tools for PDF, image and document workflows.
          </p>
        </header>

        {/* Layer 4 — search */}
        <div className="tools-directory-search-zone">
          <label htmlFor={searchId} className="sr-only">
            Search tools
          </label>
          <div className="search-focus-wrap tools-search-field-wrap rounded-2xl">
            <div className="search-focus-glow rounded-2xl" aria-hidden="true" />
            <div className="tools-search-field">
              <span className="tools-search-icon-slot" aria-hidden="true">
                <svg
                  className="tools-search-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </span>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools — merge, compress, Word to PDF..."
                className="tools-search-input"
              />
              <kbd className="tools-search-kbd-hint" aria-hidden="true">
                /
              </kbd>
            </div>
          </div>
        </div>

        {/* Layer 5 — category controls */}
        <div className="tools-directory-controls-zone space-y-3">
        <div
          role="tablist"
          aria-label="Filter tools by category"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
        >
          {TOOL_CATEGORY_FILTERS.map((item) => {
            const isActive = topLevelActive(item.id);
            const count = categoryCounts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(item.id)}
                className={`tool-category-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 ${
                  isActive ? "tool-category-pill--active" : ""
                }`}
              >
                {item.label}
                {item.id !== "all" ? (
                  <span className="ml-1.5 text-xs opacity-70">({count})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {showPdfSubfilters ? (
          <div
            role="tablist"
            aria-label="Filter PDF tools by type"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
          >
            {PDF_SUBCATEGORY_FILTERS.map((item) => {
              const isActive = activePdfSubcategory === item.id;
              const count = categoryCounts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setCategory(item.id)}
                  className={`tool-category-pill tool-category-pill--sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 ${
                    isActive ? "tool-category-pill--active" : ""
                  }`}
                >
                  {item.label}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        ) : null}
        </div>
      </div>

      {showFeatured && (
        <section aria-labelledby="featured-tools-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-scanonix-orange">
                Popular
              </p>
              <h2
                id="featured-tools-heading"
                className="mt-1.5 text-section-title text-xl sm:text-2xl"
              >
                Start with the essentials
              </h2>
            </div>
          </div>

          <div className="tools-grid-neon">
            {featuredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} featured />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-tools-heading">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="all-tools-heading" className="text-section-title text-xl sm:text-2xl">
              {showFeatured ? "All tools" : `${activeCategoryLabel} tools`}
            </h2>
            <p className="mt-0.5 text-sm text-body-bright">
              {gridTools.length} tool{gridTools.length === 1 ? "" : "s"} available
            </p>
          </div>
        </div>

        {gridTools.length > 0 ? (
          <div className="tools-grid-neon">
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
