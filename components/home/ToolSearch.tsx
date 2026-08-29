"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ToolVisual } from "@/components/tools/ToolVisual";
import {
  HOMEPAGE_CATEGORY_META,
  HOMEPAGE_TOOLS,
  type HomepageTool,
} from "@/constants/homepage-tools";
import { highlightMatch, searchHomeTools } from "@/lib/tools/search-home-tools";

interface ToolSearchProps {
  suggestions?: readonly { id: string; name: string; href: string }[];
  showSuggestions?: boolean;
}

const TOOL_SEARCH_COUNT = HOMEPAGE_TOOLS.filter((tool) => tool.available).length;

const ROTATING_PLACEHOLDERS = [
  "What do you want to do?",
  `Search ${TOOL_SEARCH_COUNT} tools…`,
  "compress PDF",
  "remove background",
  "translate document",
] as const;

function ResultLabel({ text, query }: { text: string; query: string }) {
  const highlighted = highlightMatch(text, query);
  if (!highlighted) return <>{text}</>;
  return (
    <>
      {highlighted.before}
      <mark className="rounded bg-scanonix-orange/25 px-0.5 text-foreground">{highlighted.match}</mark>
      {highlighted.after}
    </>
  );
}

export function ToolSearch({ suggestions = [], showSuggestions = true }: ToolSearchProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const results = useMemo(() => searchHomeTools(query), [query]);
  const showCustomPlaceholder = !query && !focused;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  const openResult = useCallback(
    (tool: HomepageTool) => {
      close();
      setQuery("");
      router.push(tool.href);
    },
    [close, router],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion || !showCustomPlaceholder) return;

    const rotateTimer = window.setInterval(() => {
      setPlaceholderVisible(false);
      window.setTimeout(() => {
        setPlaceholderIndex((index) => (index + 1) % ROTATING_PLACEHOLDERS.length);
        setPlaceholderVisible(true);
      }, 420);
    }, 3600);

    return () => window.clearInterval(rotateTimer);
  }, [reducedMotion, showCustomPlaceholder]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [close]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && event.key === "ArrowDown" && query.trim()) {
      setOpen(true);
      return;
    }

    if (!open || results.length === 0) {
      if (event.key === "Enter" && results[0]) {
        event.preventDefault();
        openResult(results[0]);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[activeIndex] ?? results[0];
      if (selected) openResult(selected);
    }
  }

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-3xl">
      <label htmlFor="home-tool-search" className="sr-only">
        Search tools
      </label>
      <div className="home-hero-search search-focus-wrap relative">
        <div className="search-focus-glow rounded-2xl" aria-hidden="true" />
        <div className="home-hero-search-focus-glow pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true" />
        <div className="home-hero-search-pulse-glow pointer-events-none absolute inset-0 rounded-2xl opacity-40" aria-hidden="true" />

        <Search
          className="pointer-events-none absolute left-4 top-1/2 z-[2] h-5 w-5 -translate-y-1/2 text-foreground-muted"
          aria-hidden="true"
        />

        {showCustomPlaceholder ? (
          <div
            className="pointer-events-none absolute left-12 top-1/2 z-[2] flex -translate-y-1/2 items-center gap-0.5 text-base text-foreground-muted sm:text-lg"
            aria-hidden="true"
          >
            <span className="home-hero-search-cursor h-[1.1em] w-px bg-scanonix-orange/80" />
            <span
              className={`home-hero-search-placeholder transition-opacity duration-500 ${
                placeholderVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {ROTATING_PLACEHOLDERS[placeholderIndex]}
            </span>
          </div>
        ) : null}

        <input
          ref={inputRef}
          id="home-tool-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(Boolean(event.target.value.trim()));
          }}
          onFocus={() => {
            setFocused(true);
            if (query.trim()) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleInputKeyDown}
          placeholder={showCustomPlaceholder ? "" : "What do you want to do?"}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="home-tool-search-results"
          aria-autocomplete="list"
          className="home-hero-search-input relative z-[1] w-full rounded-2xl border border-input-border bg-input-background/90 py-2.5 pl-12 pr-4 text-base text-foreground placeholder:text-foreground-muted focus:border-scanonix-orange/60 focus:outline-none focus:ring-2 focus:ring-scanonix-orange/15 sm:py-3.5 sm:text-lg"
        />
      </div>

      {open && query.trim() ? (
        <div
          id="home-tool-search-results"
          role="listbox"
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-raised)]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-foreground-muted">
              No tools found. Try &ldquo;compress PDF&rdquo;, &ldquo;translate&rdquo;, or &ldquo;remove background&rdquo;.
            </p>
          ) : (
            <ul>
              {results.map((tool, index) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openResult(tool)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      index === activeIndex ? "bg-brand-soft" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      <ToolVisual slug={tool.id} icon={tool.icon} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        <ResultLabel text={tool.name} query={query} />
                      </span>
                      <span className="mt-0.5 block text-xs text-foreground-muted">
                        {HOMEPAGE_CATEGORY_META[tool.category].label} · {tool.shortDescription}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showSuggestions && suggestions.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="home-hero-chip rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground-secondary sm:text-sm"
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
