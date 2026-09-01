import Link from "next/link";

export default function ScanReportNotFound() {
  return (
    <div className="glass-card rounded-2xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">Scan report not found</h1>
      <p className="mt-3 text-sm text-scanonix-muted">
        This report does not exist or is no longer available.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex text-sm font-semibold text-scanonix-orange hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
