import { Button } from "@/components/ui/Button";
import { ToolIcon } from "@/components/ui/ToolIcon";
import {
  getCategoryLabel,
  type ToolDirectoryEntry,
} from "@/lib/tools-directory";

interface ToolCardProps {
  tool: ToolDirectoryEntry;
  featured?: boolean;
}

export function ToolCard({ tool, featured = false }: ToolCardProps) {
  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl glass-card glass-card-interactive transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${
        featured ? "p-6 sm:p-7" : "p-5 sm:p-6"
      }`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-scanonix-orange/5 transition-transform duration-200 group-hover:scale-125" />

      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl bg-scanonix-orange/10 text-scanonix-orange transition-colors duration-300 group-hover:bg-scanonix-orange group-hover:text-white group-hover:shadow-lg group-hover:shadow-scanonix-orange/25 ${
            featured ? "h-14 w-14" : "h-12 w-12"
          }`}
        >
          <ToolIcon type={tool.icon} className={featured ? "h-7 w-7" : "h-6 w-6"} />
        </div>

        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="rounded-full border border-scanonix-orange/30 bg-scanonix-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-scanonix-orange">
            {getCategoryLabel(tool.category)}
          </span>
          {tool.privacyBadge && (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              {tool.privacyBadge}
            </span>
          )}
        </div>
      </div>

      <h3
        className={`relative text-card-title ${featured ? "text-xl" : "text-lg"}`}
      >
        {tool.name}
      </h3>
      <p className="relative mt-2 flex-1 text-body">
        {tool.description}
      </p>

      <div className="relative mt-5">
        <Button href={tool.href} size={featured ? "lg" : "md"} className="w-full">
          Open Tool
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Button>
      </div>
    </article>
  );
}
