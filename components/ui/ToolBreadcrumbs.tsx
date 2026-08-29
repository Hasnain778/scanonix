import Link from "next/link";

interface ToolBreadcrumbsProps {
  title: string;
  category?: {
    label: string;
    href: string;
  };
}

export function ToolBreadcrumbs({ title, category }: ToolBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground-muted">
        <li>
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
        </li>
        <li aria-hidden="true" className="text-border-strong">
          /
        </li>
        <li>
          <Link href="/tools" className="transition-colors hover:text-foreground">
            Tools
          </Link>
        </li>
        {category ? (
          <>
            <li aria-hidden="true" className="text-border-strong">
              /
            </li>
            <li>
              <Link href={category.href} className="transition-colors hover:text-foreground">
                {category.label}
              </Link>
            </li>
          </>
        ) : null}
        <li aria-hidden="true" className="text-border-strong">
          /
        </li>
        <li className="font-medium text-foreground" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
