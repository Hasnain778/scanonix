import type { CSSProperties } from "react";
import { resolveToolVisual, type ToolIconMotion } from "@/constants/tool-visuals";
import { ToolIcon } from "@/components/ui/ToolIcon";

export type ToolVisualSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<ToolVisualSize, { box: string; icon: string }> = {
  sm: { box: "tool-visual--sm", icon: "h-[1.125rem] w-[1.125rem]" },
  md: { box: "tool-visual--md", icon: "h-[1.375rem] w-[1.375rem]" },
  lg: { box: "tool-visual--lg", icon: "h-6 w-6" },
  xl: { box: "tool-visual--xl", icon: "h-7 w-7" },
};

interface ToolVisualProps {
  /** Canonical tool slug — preferred lookup key. */
  slug: string;
  /** Legacy icon type fallback when slug has no visual entry. */
  icon?: string;
  size?: ToolVisualSize;
  /** Enable hover/focus micro-animation (use inside interactive cards). */
  animated?: boolean;
  className?: string;
}

export function ToolVisual({
  slug,
  icon,
  size = "md",
  animated = false,
  className = "",
}: ToolVisualProps) {
  const visual = resolveToolVisual(slug, icon);
  const sizeClass = SIZE_CLASS[size];
  const motion = visual.motion as ToolIconMotion;

  const style = {
    "--tool-accent": visual.accentColor,
    "--tool-glow": visual.glowColor,
    ...(visual.secondaryAccent
      ? { "--tool-accent-secondary": visual.secondaryAccent }
      : {}),
  } as CSSProperties;

  return (
    <span
      className={`tool-visual ${sizeClass.box} tool-visual--${visual.iconFamily} ${
        animated ? "tool-visual--animated" : ""
      } ${className}`.trim()}
      style={style}
      data-motion={motion}
      data-slug={slug}
    >
      <span className="tool-visual__bloom" aria-hidden="true" />
      <span className="tool-visual__glow" aria-hidden="true" />
      <span className="tool-visual__icon">
        <ToolIcon type={visual.icon} className={sizeClass.icon} />
      </span>
    </span>
  );
}
