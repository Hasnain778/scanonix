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
      <div className="home-category-nav__bar" role="group">
        {NAV_ITEMS.map((item) => {
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelect(item.id)}
              className="home-category-nav__item"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
