import Link from "next/link";
import { FileText, ImageIcon, Shield, Sparkles } from "lucide-react";
import { HomeToolCard } from "@/components/home/HomeToolCard";
import { getToolById, HOMEPAGE_CATEGORY_META, type HomepageToolCategory } from "@/constants/homepage-tools";

const DASHBOARD_SHORTCUT_TOOL_IDS = [
  "merge-pdf",
  "compress-pdf",
  "fill-pdf",
  "background-remover",
  "protect-pdf",
  "ai-translate",
] as const;

const CATEGORY_SHORTCUTS: {
  category: HomepageToolCategory;
  icon: typeof FileText;
}[] = [
  { category: "pdf", icon: FileText },
  { category: "image", icon: ImageIcon },
  { category: "ai", icon: Sparkles },
  { category: "security", icon: Shield },
];

export function DashboardCategoryShortcuts() {
  const shortcuts = DASHBOARD_SHORTCUT_TOOL_IDS.map((id) => getToolById(id)).filter(
    (tool): tool is NonNullable<ReturnType<typeof getToolById>> => tool !== undefined,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="dashboard-tool-shortcuts-heading" className="surface-card p-5 sm:p-6">
        <h2 id="dashboard-tool-shortcuts-heading" className="text-section-title">
          Tool shortcuts
        </h2>
        <p className="mt-1.5 text-sm text-scanonix-muted">
          Open frequently used tools in one click.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shortcuts.map((tool) => (
            <HomeToolCard
              key={tool.id}
              toolId={tool.id}
              name={tool.name}
              shortDescription={tool.shortDescription}
              href={tool.href}
              icon={tool.icon}
              category={tool.category}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="dashboard-category-shortcuts-heading" className="surface-card p-5 sm:p-6">
        <h2 id="dashboard-category-shortcuts-heading" className="text-section-title">
          Categories
        </h2>
        <p className="mt-1.5 text-sm text-scanonix-muted">
          Browse tools by type.
        </p>

        <ul className="mt-5 space-y-2">
          {CATEGORY_SHORTCUTS.map(({ category, icon: Icon }) => {
            const meta = HOMEPAGE_CATEGORY_META[category];
            return (
              <li key={category}>
                <Link
                  href={meta.viewAllHref}
                  className="group flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-4 py-3 transition-colors hover:border-scanonix-orange/30 hover:bg-scanonix-orange/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-scanonix-orange/10 text-scanonix-orange">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{meta.label} tools</span>
                    <span className="block text-xs text-scanonix-muted">{meta.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
