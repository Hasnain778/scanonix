interface ToolsEmptyStateProps {
  query: string;
  categoryLabel: string;
  onClearSearch: () => void;
  onBrowseCategoryAll: () => void;
  onClearAll: () => void;
  showBrowseCategoryAll?: boolean;
}

export function ToolsEmptyState({
  query,
  categoryLabel,
  onClearSearch,
  onBrowseCategoryAll,
  onClearAll,
  showBrowseCategoryAll = false,
}: ToolsEmptyStateProps) {
  const hasQuery = Boolean(query.trim());

  return (
    <div className="tools-v2-empty">
      <div className="tools-v2-empty__icon" aria-hidden="true">
        <svg
          className="h-7 w-7"
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
      </div>
      <h3>No tools found</h3>
      <p>
        {hasQuery
          ? `No tools match “${query.trim()}” in ${categoryLabel}. Try a different search term or browse the full category.`
          : `No tools are available in ${categoryLabel} right now.`}
      </p>
      <div className="tools-v2-empty__actions">
        {hasQuery ? (
          <button type="button" onClick={onClearSearch} className="tools-v2-empty__btn">
            Clear search
          </button>
        ) : null}
        {showBrowseCategoryAll ? (
          <button
            type="button"
            onClick={onBrowseCategoryAll}
            className={hasQuery ? "tools-v2-empty__btn tools-v2-empty__btn--ghost" : "tools-v2-empty__btn"}
          >
            View all in category
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClearAll}
          className={
            hasQuery || showBrowseCategoryAll
              ? "tools-v2-empty__btn tools-v2-empty__btn--ghost"
              : "tools-v2-empty__btn"
          }
        >
          Browse all tools
        </button>
      </div>
    </div>
  );
}
