export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md bg-scanonix-orange/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-scanonix-orange ${className}`}
    >
      Pro
    </span>
  );
}
