export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`pro-badge ${className}`.trim()}>
      Pro
    </span>
  );
}
