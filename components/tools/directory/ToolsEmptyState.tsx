interface ToolsEmptyStateProps {
  query: string;
  categoryLabel: string;
  onClear: () => void;
}

export function ToolsEmptyState({
  query,
  categoryLabel,
  onClear,
}: ToolsEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center sm:py-20">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl glass text-scanonix-orange">
        <svg
          className="h-8 w-8"
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
      </div>
      <h3 className="text-xl font-semibold text-white">No tools found</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-scanonix-muted">
        {query.trim()
          ? `Nothing matched "${query}" in ${categoryLabel}. Try a different search term or category.`
          : `No tools are available in ${categoryLabel} right now.`}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-scanonix-orange/50 hover:text-scanonix-orange"
      >
        Clear filters
      </button>
    </div>
  );
}
