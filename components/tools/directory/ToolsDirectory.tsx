"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState } from "react";
import { ToolCard } from "@/components/tools/directory/ToolCard";
import { ToolsEmptyState } from "@/components/tools/directory/ToolsEmptyState";
import {
  getActiveSubcategoryFilter,
  getCategoryFilterLabel,
  getPrimaryAllFilter,
  getPrimaryFamily,
  getSubcategoryFilters,
  isAiCategoryFilter,
  isImageCategoryFilter,
  isPdfCategoryFilter,
  isSecurityCategoryFilter,
} from "@/constants/tool-categories";
import {
  filterTools,
  getCategoryCounts,
  getFeaturedTools,
  SCANONIX_TOOLS,
  TOOL_CATEGORY_FILTERS,
  type ToolCategoryFilterId,
} from "@/lib/tools-directory";
import { getToolsCategoryHref } from "@/lib/navigation/tool-category-urls";
import { getImageToolsHubHref } from "@/lib/navigation/category-hub-urls";

interface ToolsDirectoryProps {
  /** Server-resolved category so initial HTML includes crawlable tool links. */
  initialCategory: ToolCategoryFilterId;
}

export function ToolsDirectory({ initialCategory }: ToolsDirectoryProps) {
  const router = useRouter();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategoryState] = useState(initialCategory);
  const [prevInitialCategory, setPrevInitialCategory] = useState(initialCategory);

  // Sync URL-driven category without useEffect (avoids set-state-in-effect lint).
  if (initialCategory !== prevInitialCategory) {
    setPrevInitialCategory(initialCategory);
    setCategoryState(initialCategory);
  }

  const primaryFamily = getPrimaryFamily(category);
  const subcategoryFilters = useMemo(
    () => getSubcategoryFilters(category),
    [category],
  );
  const activeSubcategory = getActiveSubcategoryFilter(category);
  const showSubcategories = subcategoryFilters.length > 0;

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
      setCategoryState(next);
      router.push(getToolsCategoryHref(next), { scroll: false });
    },
    [router],
  );

  const handlePrimaryCategory = useCallback(
    (next: ToolCategoryFilterId) => {
      // Switching primary always resets subcategory to that family's All.
      setCategory(next);
    },
    [setCategory],
  );

  const handleClearSearch = () => {
    setQuery("");
  };

  const handleClearAll = () => {
    setQuery("");
    setCategoryState("all");
    router.push(getToolsCategoryHref("all"), { scroll: false });
  };

  const handleBrowseCategoryAll = () => {
    setQuery("");
    const primaryAll = getPrimaryAllFilter(category);
    setCategory(primaryAll);
  };

  const topLevelActive = (id: ToolCategoryFilterId) => {
    if (id === "pdf") return isPdfCategoryFilter(category);
    if (id === "image") return isImageCategoryFilter(category);
    if (id === "ai") return isAiCategoryFilter(category);
    if (id === "security") return isSecurityCategoryFilter(category);
    return category === id;
  };

  return (
    <div className="tools-v2-body">
      <div className="tools-directory-search-zone">
        <label htmlFor={searchId} className="sr-only">
          Search tools
        </label>
        <div className="search-focus-wrap tools-search-field-wrap">
          <div className="search-focus-glow" aria-hidden="true" />
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

      <div className="tools-directory-controls-zone">
        <div
          role="tablist"
          aria-label="Filter tools by category"
          className="tools-v2-cat-row -mx-1 overflow-x-auto px-1 sm:overflow-visible"
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
                onClick={() => handlePrimaryCategory(item.id)}
                className={`tools-v2-cat${isActive ? " tools-v2-cat--active" : ""}`}
              >
                {item.label}
                {item.id !== "all" ? (
                  <span className="tools-v2-cat__count">({count})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {showSubcategories ? (
          <div className="tools-v2-subnav" aria-label={`${primaryFamily} tool types`}>
            <p className="tools-v2-subnav__label">Browse by type</p>
            <div
              role="tablist"
              aria-label={`Filter ${primaryFamily} tools by type`}
              className="tools-v2-subnav__row -mx-1 overflow-x-auto px-1 sm:overflow-visible"
            >
              {subcategoryFilters.map((item) => {
                const isActive = activeSubcategory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setCategory(item.id)}
                    className={`tools-v2-sub${isActive ? " tools-v2-sub--active" : ""}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <p className="tools-v2-hub-link">
          <Link href={getImageToolsHubHref()}>Browse Image Tools hub</Link>
          <span>
            {" "}
            — converters, editors, and format guides in one place.
          </span>
        </p>
      </div>

      {showFeatured && (
        <section aria-labelledby="featured-tools-heading">
          <div className="tools-v2-section-head">
            <p className="tools-v2-section-eyebrow">Popular</p>
            <h2 id="featured-tools-heading" className="tools-v2-section-title">
              Start with the essentials
            </h2>
          </div>

          <div className="tools-grid-v2">
            {featuredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} featured />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-tools-heading">
        <div className="tools-v2-section-head">
          <h2 id="all-tools-heading" className="tools-v2-section-title">
            {showFeatured ? "All tools" : `${activeCategoryLabel} tools`}
          </h2>
          <p className="tools-v2-section-meta">
            {gridTools.length} tool{gridTools.length === 1 ? "" : "s"} available
          </p>
        </div>

        {gridTools.length > 0 ? (
          <div className="tools-grid-v2">
            {gridTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        ) : (
          <ToolsEmptyState
            query={query}
            categoryLabel={activeCategoryLabel}
            onClearSearch={handleClearSearch}
            onBrowseCategoryAll={handleBrowseCategoryAll}
            onClearAll={handleClearAll}
            showBrowseCategoryAll={Boolean(primaryFamily)}
          />
        )}
      </section>
    </div>
  );
}
