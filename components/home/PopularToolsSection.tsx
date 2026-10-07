import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeToolCard } from "@/components/home/HomeToolCard";
import { getPopularTools, POPULAR_TOOL_IDS } from "@/constants/homepage-tools";

export function PopularToolsSection() {
  const tools = getPopularTools();

  return (
    <section id="popular-tools" className="border-t border-border py-12 sm:py-14">
      <div className="page-container">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-section-title text-2xl sm:text-3xl">Popular tools</h2>
            <p className="mt-2 text-sm text-body-bright sm:text-base">
              The most-used tools to get started quickly.
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-scanonix-orange transition-colors hover:text-scanonix-orange-light"
          >
            Browse all tools
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <HomeToolCard
              key={tool.id}
              toolId={tool.id}
              name={tool.name}
              shortDescription={tool.shortDescription}
              href={tool.href}
              icon={tool.icon}
              category={tool.category}
              popular={(POPULAR_TOOL_IDS as readonly string[]).includes(tool.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
