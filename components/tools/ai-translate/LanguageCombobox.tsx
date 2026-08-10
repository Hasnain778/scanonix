"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface LanguageComboboxProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function LanguageCombobox({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: LanguageComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={listId} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-scanonix-muted">
        {label}
      </label>
      <button
        id={listId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-scanonix-border bg-black/40 px-3 py-2.5 text-left text-sm text-white transition-colors hover:border-scanonix-orange/40 focus:border-scanonix-orange focus:outline-none focus:ring-1 focus:ring-scanonix-orange disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-scanonix-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-scanonix-border bg-[#111111] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-scanonix-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search languages…"
              className="w-full bg-transparent text-sm text-white placeholder:text-scanonix-muted focus:outline-none"
              autoFocus
            />
          </div>
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
            aria-label={label}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-scanonix-muted">No languages found</li>
            ) : (
              filtered.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option === value}
                    onClick={() => {
                      onChange(option);
                      setQuery("");
                      setOpen(false);
                    }}
                    className={`flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-scanonix-orange/10 hover:text-white ${
                      option === value ? "bg-scanonix-orange/15 text-scanonix-orange" : "text-neutral-200"
                    }`}
                  >
                    {option}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
