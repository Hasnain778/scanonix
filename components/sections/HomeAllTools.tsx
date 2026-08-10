"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  getHomeToolsForFilter,
  HOME_TOOL_FILTERS,
  type HomeToolEntry,
  type HomeToolFilter,
} from "@/components/sections/home-tools-data";
import { HomeScrollFade } from "@/components/ui/HomeScrollFade";

function ToolFeatured({ tool }: { tool: HomeToolEntry }) {
  const Icon = tool.icon;

  return (
    <Link
      href={tool.href}
      className="home-tool-featured group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 sm:min-h-[260px] sm:p-8 lg:col-span-2 lg:row-span-2"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,106,0,0.12)_0%,transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="relative">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-scanonix-orange/25 bg-scanonix-orange/10 text-scanonix-orange">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-xl font-semibold text-white sm:text-2xl">{tool.name}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-scanonix-muted sm:text-base">
          {tool.description}
        </p>
      </div>
      <span className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-scanonix-orange">
        Open tool
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

function ToolMedium({ tool }: { tool: HomeToolEntry }) {
  const Icon = tool.icon;

  return (
    <Link
      href={tool.href}
      className="home-tool-medium group flex flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-5 sm:p-6"
    >
      <div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white">
          <Icon className="h-4 w-4 text-scanonix-orange" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-base font-semibold text-white">{tool.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-scanonix-muted">
          {tool.description}
        </p>
      </div>
      <ArrowUpRight
        className="mt-4 h-4 w-4 text-scanonix-muted transition-colors group-hover:text-scanonix-orange"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </Link>
  );
}

function ToolCompact({ tool }: { tool: HomeToolEntry }) {
  const Icon = tool.icon;

  return (
    <Link
      href={tool.href}
      className="home-tool-compact group flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3.5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-black/30">
        <Icon className="h-4 w-4 text-scanonix-orange/90" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{tool.name}</p>
        <p className="truncate text-xs text-scanonix-muted">{tool.description}</p>
      </div>
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 text-scanonix-muted/60 transition-colors group-hover:text-scanonix-orange"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </Link>
  );
}

function ToolBrowser({ filter }: { filter: HomeToolFilter }) {
  const tools = getHomeToolsForFilter(filter);

  if (tools.length === 0) {
    return null;
  }

  const featured = tools[0];
  const medium = tools.slice(1, filter === "all" ? 5 : 3);
  const compact = tools.slice(filter === "all" ? 5 : 4);

  if (filter === "all") {
    return (
      <div className="grid gap-4 lg:grid-cols-4 lg:grid-rows-[auto_auto_auto]">
        <ToolFeatured tool={featured} />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {medium.map((tool) => (
            <ToolMedium key={tool.id} tool={tool} />
          ))}
        </div>
        <div className="space-y-2 lg:col-span-4">
          {compact.map((tool) => (
            <ToolCompact key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ToolFeatured tool={featured} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
        {medium.map((tool) => (
          <ToolMedium key={tool.id} tool={tool} />
        ))}
      </div>
      {compact.length > 0 ? (
        <div className="space-y-2 lg:col-span-3">
          {compact.map((tool) => (
            <ToolCompact key={tool.id} tool={tool} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomeAllTools() {
  const [activeFilter, setActiveFilter] = useState<HomeToolFilter>("all");

  return (
    <section id="tools" className="relative overflow-x-clip py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
        aria-hidden="true"
      />

      <div className="page-container">
        <HomeScrollFade>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              All tools
            </h2>
            <p className="mt-4 text-base leading-relaxed text-scanonix-muted sm:text-lg">
              Everything you need, organized in one place.
            </p>
          </div>
        </HomeScrollFade>

        <HomeScrollFade delay={60} className="mt-10 sm:mt-12">
          <div
            className="home-tool-tabs -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
            role="tablist"
            aria-label="Tool categories"
          >
            {HOME_TOOL_FILTERS.map((tab) => {
              const selected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`home-tool-tab shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border border-scanonix-orange/40 bg-scanonix-orange/10 text-white"
                      : "border border-white/8 bg-white/[0.02] text-scanonix-muted hover:border-white/14 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </HomeScrollFade>

        <HomeScrollFade delay={100} className="mt-8 sm:mt-10">
          <div key={activeFilter} className="home-tool-browser-enter">
            <ToolBrowser filter={activeFilter} />
          </div>
        </HomeScrollFade>
      </div>
    </section>
  );
}
