import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { ToolVisual } from "@/components/tools/ToolVisual";
import { ProBadge } from "@/components/ui/ProBadge";
import { resolveToolVisual } from "@/constants/tool-visuals";
import { FEATURED_TOOL_IDS } from "@/constants/tools-directory-data";
import { getToolAccess } from "@/lib/plan/tool-access";
import type { ToolDirectoryEntry } from "@/lib/tools-directory";

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
      className={`tool-card-v2 group focus-visible:outline-none${featured ? " tool-card-v2--featured" : ""}`}
      style={cardStyle}
    >
      <div className="tool-card-v2__top">
        <span className="tool-card-v2__icon-tile" aria-hidden="true">
          <ToolVisual slug={tool.id} icon={tool.icon} size="lg" animated />
        </span>

        {(isPopular || access?.requiresPro) && (
          <div className="tool-card-v2__meta">
            {isPopular ? <span className="tool-card-v2__popular">Popular</span> : null}
            {access?.requiresPro ? <ProBadge /> : null}
          </div>
        )}
      </div>

      <h3 className="tool-card-v2__title">{tool.name}</h3>
      <p className="tool-card-v2__desc">{tool.description}</p>

      <span className="tool-card-v2__cta">
        Open tool
        <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}
