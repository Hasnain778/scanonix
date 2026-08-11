interface ToolLaunchUnavailableProps {
  title?: string;
  message: string;
}

export function ToolLaunchUnavailable({
  title = "Temporarily unavailable",
  message,
}: ToolLaunchUnavailableProps) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-scanonix-surface px-6 py-10 text-center"
      role="status"
    >
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-scanonix-muted"
        aria-hidden="true"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-scanonix-muted">{message}</p>
    </div>
  );
}
