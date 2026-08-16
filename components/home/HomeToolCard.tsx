import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { ToolVisual } from "@/components/tools/ToolVisual";
import { ProBadge } from "@/components/ui/ProBadge";
import { resolveToolVisual } from "@/constants/tool-visuals";
import { HOMEPAGE_CATEGORY_META, type HomepageToolCategory } from "@/constants/homepage-tools";

interface HomeToolCardProps {
  /** Canonical tool slug — drives icon identity. */
  toolId: string;
  name: string;
  shortDescription: string;
  href?: string;
  /** @deprecated Use toolId — kept for backward compatibility */
  icon?: string;
  category: HomepageToolCategory;
  comingSoon?: boolean;
  proOnly?: boolean;
  popular?: boolean;
  /** @deprecated Use unified compact styling — kept for API compatibility */
  premium?: boolean;
}

export function HomeToolCard({
  toolId,
  name,
  shortDescription,
  href,
  icon,
  category,
  comingSoon = false,
  proOnly = false,
  popular = false,
}: HomeToolCardProps) {
  const categoryLabel = HOMEPAGE_CATEGORY_META[category].label;
  const visual = resolveToolVisual(toolId, icon);

  const cardStyle = {
    "--tool-accent": visual.accentColor,
    "--tool-glow": visual.glowColor,
  } as CSSProperties;

  const content = (
    <>
      <ToolVisual slug={toolId} icon={icon} size="md" animated />

      <span className="text-tool-name mt-4 block text-sm sm:text-[0.9375rem] group-hover:text-white">
        {name}
      </span>

      <span className="text-body-bright mt-1 block flex-1 text-sm leading-snug line-clamp-2">
        {shortDescription}
      </span>

      <span className="mt-3.5 flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          {popular ? <span className="tool-badge-popular">Popular</span> : null}
          {comingSoon ? (
            <span className="tool-badge-category">Coming soon</span>
          ) : (
            <span className="tool-badge-category">{categoryLabel}</span>
          )}
          {proOnly && !comingSoon ? <ProBadge /> : null}
        </span>
        {!comingSoon && href ? (
          <ArrowRight
            className="h-4 w-4 shrink-0 text-scanonix-muted transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-scanonix-orange-light"
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : null}
      </span>
    </>
  );

  if (comingSoon || !href) {
    return (
      <div
        className="tool-card-neon opacity-70"
        style={cardStyle}
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="tool-card-neon group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
      style={cardStyle}
    >
      {content}
    </Link>
  );
}
