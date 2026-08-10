interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  className = "",
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          {label && <span className="font-medium text-white">{label}</span>}
          {showPercent && (
            <span className="text-scanonix-muted">{percent}%</span>
          )}
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className="h-full rounded-full bg-scanonix-orange transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
