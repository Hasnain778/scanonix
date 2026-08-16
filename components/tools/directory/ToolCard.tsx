import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { ToolVisual } from "@/components/tools/ToolVisual";
import { ProBadge } from "@/components/ui/ProBadge";
import { resolveToolVisual } from "@/constants/tool-visuals";
import { FEATURED_TOOL_IDS } from "@/constants/tools-directory-data";
import { getToolAccess } from "@/lib/plan/tool-access";
import {
  getCategoryLabel,
  type ToolDirectoryEntry,
} from "@/lib/tools-directory";

interface ToolCardProps {
  tool: ToolDirectoryEntry;
  featured?: boolean;
}

export function ToolCard({ tool, featured = false }: ToolCardProps) {
  const visual = resolveToolVisual(tool.id, tool.icon);
  const access = getToolAccess(tool.id);
  const isPopular = (FEATURED_TOOL_IDS as readonly string[]).includes(tool.id);

  const cardStyle = {
    "--tool-accent": visual.accentColor,
    "--tool-glow": visual.glowColor,
  } as CSSProperties;

  return (
    <Link
      href={tool.href}
      className="tool-card-neon group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <ToolVisual
          slug={tool.id}
          icon={tool.icon}
          size={featured ? "lg" : "md"}
          animated
        />

        <div className="flex flex-wrap justify-end gap-1.5">
          {isPopular ? (
            <span className="tool-badge-popular">Popular</span>
          ) : null}
          {access?.requiresPro ? <ProBadge /> : null}
          <span className="tool-badge-category">{getCategoryLabel(tool.category)}</span>
        </div>
      </div>

      <h3 className={`text-tool-name mt-4 ${featured ? "text-[0.9375rem] sm:text-base" : "text-sm sm:text-[0.9375rem]"}`}>
        {tool.name}
      </h3>
      <p className="text-body-bright mt-1 flex-1 text-sm leading-relaxed line-clamp-2">
        {tool.description}
      </p>

      <span className="mt-3.5 inline-flex items-center gap-1.5 text-sm font-medium text-scanonix-orange-light transition-colors group-hover:text-scanonix-orange">
        Open tool
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
