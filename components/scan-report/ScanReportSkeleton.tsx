export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-muted ${className}`}
      aria-hidden="true"
    />
  );
}

export function ScanReportSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading scan report">
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <SkeletonLine className="h-4 w-32" />
            <SkeletonLine className="h-10 w-3/4 max-w-lg" />
            <div className="grid gap-3 sm:grid-cols-3">
              <SkeletonLine className="h-16 w-full rounded-xl" />
              <SkeletonLine className="h-16 w-full rounded-xl" />
              <SkeletonLine className="h-16 w-full rounded-xl" />
            </div>
          </div>
          <SkeletonLine className="mx-auto h-40 w-40 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-card rounded-2xl p-5">
            <SkeletonLine className="mb-3 h-3 w-24" />
            <SkeletonLine className="h-9 w-16" />
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-6">
        <SkeletonLine className="mb-4 h-6 w-40" />
        <SkeletonLine className="h-24 w-full rounded-xl" />
        <SkeletonLine className="mt-3 h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
