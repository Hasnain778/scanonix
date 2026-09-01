export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-muted ${className}`} aria-hidden="true" />;
}

export function ScanHistorySkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading scan history">
      <div className="glass-card rounded-2xl p-6">
        <SkeletonLine className="mb-3 h-8 w-48" />
        <SkeletonLine className="h-4 w-72" />
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
        <SkeletonLine className="mb-4 h-10 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonLine key={index} className="mb-3 h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
