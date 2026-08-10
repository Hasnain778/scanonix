export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/8 ${className}`}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-9 w-20" />
          <SkeletonLine className="h-3 w-32" />
        </div>
        <SkeletonLine className="h-12 w-12 shrink-0 rounded-xl" />
      </div>
    </div>
  );
}

export function HeaderMetricSkeleton() {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
      <SkeletonLine className="mb-2 h-3 w-20" />
      <SkeletonLine className="h-5 w-28" />
    </div>
  );
}

export function UsageCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <SkeletonLine className="mb-4 h-5 w-36" />
      <SkeletonLine className="mb-6 h-3 w-full rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonLine className="h-14 w-full rounded-xl" />
        <SkeletonLine className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function SecurityStatusSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0c0c0c]/60 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <SkeletonLine className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-5 w-36" />
            <SkeletonLine className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonLine className="h-10 w-36 rounded-xl" />
          <SkeletonLine className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function RecentScansSkeleton() {
  return (
    <div>
      <SkeletonLine className="mb-5 h-5 w-32" />
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="relative pl-8">
            <SkeletonLine className="absolute left-0 top-6 h-3 w-3 rounded-full" />
            <div className="rounded-2xl border border-white/8 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 space-y-2">
                  <SkeletonLine className="h-5 w-48" />
                  <SkeletonLine className="h-4 w-24" />
                </div>
                <div className="flex gap-3">
                  <SkeletonLine className="h-8 w-16 rounded-full" />
                  <SkeletonLine className="h-10 w-28 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
