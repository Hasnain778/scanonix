import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import type { ImageHubTool } from "@/constants/image-tools";
import { ImageToolIconBox } from "@/components/image-tools/ImageToolIconBox";

interface HubToolLinkProps {
  tool: ImageHubTool;
  icon: LucideIcon;
}

export function HubToolLink({ tool, icon }: HubToolLinkProps) {
  return (
    <Link
      href={tool.href}
      className="image-medium-card group flex h-full flex-col rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-white/12 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <ImageToolIconBox icon={icon} />
        {tool.badge ? (
          <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium text-scanonix-muted">
            {tool.badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{tool.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-scanonix-muted">{tool.description}</p>
      {tool.fileSupport ? (
        <p className="mt-2 text-xs text-scanonix-muted/70">Supports {tool.fileSupport}</p>
      ) : null}
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-scanonix-muted group-hover:text-scanonix-orange">
        Open tool
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
