"use client";

import { useCallback } from "react";
import {
  HOMEPAGE_CATEGORY_META,
} from "@/constants/homepage-tools";

export type HomeCategoryFilter = "all" | "pdf" | "image" | "ai";

const NAV_ITEMS: { id: HomeCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: HOMEPAGE_CATEGORY_META.pdf.label },
  { id: "image", label: HOMEPAGE_CATEGORY_META.image.label },
  { id: "ai", label: HOMEPAGE_CATEGORY_META.ai.label },
];

interface HomeCategoryNavProps {
  activeCategory: HomeCategoryFilter;
  onCategoryChange: (category: HomeCategoryFilter) => void;
}

export function HomeCategoryNav({ activeCategory, onCategoryChange }: HomeCategoryNavProps) {
  const handleSelect = useCallback(
    (category: HomeCategoryFilter) => {
      onCategoryChange(category);
      if (typeof window !== "undefined") {
        const hash = category === "all" ? "popular-tools" : HOMEPAGE_CATEGORY_META[category].anchor;
        window.history.replaceState(null, "", `#${hash}`);
      }
    },
    [onCategoryChange],
  );

  return (
    <nav aria-label="Browse tools by category" className="home-category-nav">
      <div className="home-category-nav__scroll max-sm:overflow-visible sm:overflow-x-auto sm:overscroll-x-contain sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:min-w-min sm:gap-2 sm:px-0.5 sm:pb-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeCategory === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleSelect(item.id)}
                className={`home-category-nav__pill shrink-0 rounded-full border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40 sm:px-4 sm:py-2.5 sm:text-sm ${
                  isActive
                    ? "border-scanonix-orange/50 bg-scanonix-orange/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-neutral-200 hover:border-scanonix-orange/30 hover:bg-scanonix-orange/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
