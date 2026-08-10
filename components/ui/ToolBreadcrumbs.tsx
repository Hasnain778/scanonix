import Link from "next/link";

interface ToolBreadcrumbsProps {
  title: string;
}

export function ToolBreadcrumbs({ title }: ToolBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-scanonix-muted">
        <li>
          <Link href="/" className="transition-colors hover:text-white">
            Home
          </Link>
        </li>
        <li aria-hidden="true" className="text-white/20">
          /
        </li>
        <li>
          <Link href="/tools" className="transition-colors hover:text-white">
            Tools
          </Link>
        </li>
        <li aria-hidden="true" className="text-white/20">
          /
        </li>
        <li className="font-medium text-white" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
