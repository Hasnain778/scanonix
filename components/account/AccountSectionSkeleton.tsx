import { Skeleton } from "@/components/common/Skeleton";

export function AccountSectionSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="surface-card p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-5 space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="surface-card p-6">
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
