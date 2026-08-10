import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { HOMEPAGE_CATEGORY_META, type HomepageToolCategory } from "@/constants/homepage-tools";

interface HomeToolCardProps {
  name: string;
  shortDescription: string;
  href?: string;
  icon: string;
  category: HomepageToolCategory;
  comingSoon?: boolean;
  proOnly?: boolean;
  /** Premium styling for the Popular Tools section */
  premium?: boolean;
}

const CATEGORY_BADGE: Record<
  HomepageToolCategory,
  { label: string; className: string }
> = {
  pdf: {
    label: "PDF",
    className: "bg-scanonix-orange/30 text-orange-100",
  },
  ai: {
    label: "AI",
    className: "bg-violet-500/30 text-violet-200",
  },
  image: {
    label: "IMAGE",
    className: "bg-sky-500/30 text-sky-200",
  },
  security: {
    label: "SECURITY",
    className: "bg-emerald-500/30 text-emerald-200",
  },
};

export function HomeToolCard({
  name,
  shortDescription,
  href,
  icon,
  category,
  comingSoon = false,
  proOnly = false,
  premium = false,
}: HomeToolCardProps) {
  const categoryLabel = HOMEPAGE_CATEGORY_META[category].label;
  const badge = CATEGORY_BADGE[category];

  if (premium) {
    const content = (
      <>
        <span className="popular-tool-icon flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.05] text-scanonix-orange">
          <ToolIcon type={icon} className="h-7 w-7" />
        </span>

        <span className="popular-tool-title mt-6 block text-[17px] font-bold leading-snug text-white sm:text-lg sm:font-extrabold">
          {name}
        </span>

        <span className="mt-2.5 block text-sm leading-relaxed text-scanonix-muted">{shortDescription}</span>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                comingSoon ? "bg-white/10 text-scanonix-muted" : badge.className
              }`}
            >
              {comingSoon ? "Coming soon" : badge.label}
            </span>
            {proOnly && !comingSoon ? <ProBadge /> : null}
          </span>
          {!comingSoon && href ? (
            <span className="flex items-center gap-1.5">
              {proOnly ? (
                <Shield className="h-3.5 w-3.5 text-scanonix-orange" aria-hidden="true" />
              ) : null}
              <ArrowRight
                className="popular-tool-arrow h-4 w-4 shrink-0 text-scanonix-muted"
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>
          ) : null}
        </div>
      </>
    );

    if (comingSoon || !href) {
      return (
        <div className="popular-tool-card flex h-full flex-col rounded-3xl border border-white/[0.06] bg-[#131313] p-6 opacity-70 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
          {content}
        </div>
      );
    }

    return (
      <span className="popular-tool-card-shell group block h-full">
        <Link href={href} className="popular-tool-card flex h-full flex-col rounded-3xl p-7">
          {content}
        </Link>
      </span>
    );
  }

  const content = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-scanonix-orange">
        <ToolIcon type={icon} className="h-5 w-5" />
      </span>
      <span className="mt-4 block text-sm font-semibold text-white">{name}</span>
      <span className="mt-1.5 block text-sm leading-snug text-scanonix-muted">{shortDescription}</span>
      <span className="mt-4 inline-flex items-center gap-2">
        <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-scanonix-muted">
          {comingSoon ? "Coming soon" : categoryLabel}
        </span>
        {proOnly && !comingSoon ? <ProBadge /> : null}
        {proOnly && !comingSoon ? (
          <Shield className="h-3.5 w-3.5 text-scanonix-orange" aria-hidden="true" />
        ) : null}
      </span>
    </>
  );

  if (comingSoon || !href) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-white/8 bg-[#0e0e0e] p-5 opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border border-white/8 bg-[#0e0e0e] p-5 transition-colors hover:border-scanonix-orange/35 hover:bg-[#121212]"
    >
      {content}
    </Link>
  );
}
