export async function downloadReportPdf(
  reportId: string,
): Promise<
  | { ok: true }
  | { error: string; status: number; upgrade?: boolean }
> {
  const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/pdf`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 403) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      error: data.error ?? "Upgrade to Pro or Business to unlock premium report exports.",
      status: 403,
      upgrade: true,
    };
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      error: data.error ?? "Could not generate PDF report.",
      status: response.status,
    };
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scanonix-report-${reportId}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);

  return { ok: true };
}
