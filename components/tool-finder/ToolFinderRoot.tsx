"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import {
  useClientMounted,
  useConsentDecision,
} from "@/components/analytics/ConsentContext";
import { ToolVisual } from "@/components/tools/ToolVisual";
import { HOMEPAGE_CATEGORY_META } from "@/constants/homepage-tools";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import { findTools, type ToolFinderMatch } from "@/lib/tools/tool-finder";

const EXAMPLE_PROMPTS = [
  "Convert PDF to Word",
  "Merge these PDFs",
  "Remove image background",
  "Translate to Spanish",
] as const;

export function ToolFinderRoot() {
  const reduceMotion = useReducedMotion();
  const mounted = useClientMounted();
  const consentDecision = useConsentDecision();
  /** Match ConsentBanner: hide FAB while Accept/Reject is still pending. */
  const consentPending = mounted && consentDecision === "undecided";
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const searchSubmitGuardRef = useRef(false);

  const result = useMemo(
    () => (submittedQuery.trim() ? findTools(submittedQuery) : null),
    [submittedQuery],
  );

  const submitSearch = useCallback((rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed || searchSubmitGuardRef.current) {
      return;
    }

    searchSubmitGuardRef.current = true;
    const searchResult = findTools(trimmed);
    trackEvent("find_tool_search", {
      query_length: trimmed.length,
      result_count: searchResult.matches.length,
      source_surface: ANALYTICS_SURFACES.TOOL_FINDER,
    });
    setSubmittedQuery(trimmed);
    searchSubmitGuardRef.current = false;
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);

  const handleSubmit = useCallback(() => {
    submitSearch(query);
  }, [query, submitSearch]);

  const handleOpenTool = useCallback(() => {
    close();
    setQuery("");
    setSubmittedQuery("");
  }, [close]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), reduceMotion ? 0 : 120);
    return () => window.clearTimeout(timer);
  }, [open, reduceMotion]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (launcherRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [close, open]);

  if (consentPending) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            aria-label="Close assistant backdrop"
            className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-[2px] lg:bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            onClick={close}
          />
        ) : null}
      </AnimatePresence>

      <div
        ref={launcherRef}
        className="pointer-events-none fixed bottom-20 right-4 z-[80] flex flex-col items-end gap-3 sm:right-6 lg:bottom-6"
      >
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={panelRef}
              id="tool-finder-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tool-finder-title"
              className="pointer-events-auto w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:w-[min(calc(100vw-3rem),26rem)]"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{
                duration: reduceMotion ? 0.01 : 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.12),transparent_58%)] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-scanonix-orange" aria-hidden="true" />
                      <h2 id="tool-finder-title" className="text-base font-semibold text-white">
                        Tool Finder
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-scanonix-muted">
                      Describe what you want to do in plain language.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-scanonix-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
                    aria-label="Close Tool Finder"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="space-y-2">
                  <label htmlFor="tool-finder-query" className="sr-only">
                    Describe the tool you need
                  </label>
                  <textarea
                    ref={inputRef}
                    id="tool-finder-query"
                    rows={3}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder='e.g. "Convert PDF to Word"'
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-scanonix-muted focus:border-scanonix-orange/40 focus:outline-none focus:ring-2 focus:ring-scanonix-orange/15"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!query.trim()}
                    className="h-11 w-full rounded-2xl bg-scanonix-orange text-sm font-semibold text-white transition-colors hover:bg-scanonix-orange-light disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
                  >
                    Find Tool
                  </button>
                </div>

                {!submittedQuery ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-scanonix-muted">
                      Try asking
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EXAMPLE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => {
                            setQuery(prompt);
                            submitSearch(prompt);
                          }}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-scanonix-muted transition-colors hover:border-scanonix-orange/30 hover:bg-scanonix-orange/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {result ? (
                  <div className="space-y-3">
                    {result.noMatch && result.matches.length === 0 ? (
                      <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-scanonix-muted">
                        I couldn&apos;t find an exact match for that request. Here are similar tools
                        you might need:
                      </div>
                    ) : null}

                    {result.noMatch && result.matches.length > 0 ? (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        No exact match found. These are the closest tools:
                      </div>
                    ) : null}

                    {result.matches.length > 0 ? (
                      <ul className="space-y-3" aria-label="Matching tools">
                        {result.matches.map((match, index) => (
                          <MatchCard
                            key={match.tool.id}
                            match={match}
                            rank={index + 1}
                            onNavigate={handleOpenTool}
                          />
                        ))}
                      </ul>
                    ) : null}

                    {result.noMatch && result.suggestions.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-scanonix-muted">
                          Suggested tools
                        </p>
                        <ul className="space-y-2">
                          {result.suggestions.map((tool) => (
                            <li key={tool.id}>
                              <Link
                                href={tool.href}
                                onClick={handleOpenTool}
                                className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 text-sm text-white transition-colors hover:border-scanonix-orange/30 hover:bg-scanonix-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
                              >
                                <ToolVisual slug={tool.id} icon={tool.icon} size="sm" />
                                <span>{tool.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-expanded={open}
          aria-controls="tool-finder-panel"
          aria-label={open ? "Close Tool Finder" : "Open Tool Finder"}
          onClick={open ? close : openPanel}
          className="tool-finder-launcher pointer-events-auto flex h-14 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50 sm:px-5"
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          <Sparkles className="tool-finder-launcher__icon h-5 w-5 text-scanonix-orange" aria-hidden="true" />
          <span className="hidden sm:inline">Find a Tool</span>
          <span className="sm:hidden">Tools</span>
        </motion.button>
      </div>
    </>
  );
}

function MatchCard({
  match,
  rank,
  onNavigate,
}: {
  match: ToolFinderMatch;
  rank: number;
  onNavigate: () => void;
}) {
  const categoryLabel = HOMEPAGE_CATEGORY_META[match.tool.category].label;

  return (
    <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <ToolVisual slug={match.tool.id} icon={match.tool.icon} size="md" animated />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-tool-name text-sm">{match.tool.name}</p>
            {rank === 1 ? (
              <span className="rounded-full bg-scanonix-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-scanonix-orange">
                Best match
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-scanonix-muted">{categoryLabel}</p>
          <p className="mt-2 text-sm leading-relaxed text-scanonix-muted">{match.explanation}</p>
          <Link
            href={match.tool.href}
            onClick={onNavigate}
            className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-scanonix-orange px-4 text-xs font-semibold text-white transition-colors hover:bg-scanonix-orange-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/50"
          >
            Open Tool
          </Link>
        </div>
      </div>
    </li>
  );
}
