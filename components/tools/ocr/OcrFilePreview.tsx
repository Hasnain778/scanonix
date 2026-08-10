interface OcrFilePreviewProps {
  fileName: string;
  fileSizeLabel: string;
  previewUrl: string | null;
  isPdf: boolean;
  pageCount?: number;
}

export function OcrFilePreview({
  fileName,
  fileSizeLabel,
  previewUrl,
  isPdf,
  pageCount,
}: OcrFilePreviewProps) {
  return (
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">File preview</h2>
      <p className="mt-1 truncate text-sm text-scanonix-muted">
        {fileName} · {fileSizeLabel}
        {isPdf && pageCount !== undefined
          ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}`
          : ""}
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-scanonix-border bg-black/40">
        {previewUrl ? (
          <div className="flex max-h-[420px] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={isPdf ? "PDF first page preview" : fileName}
              className="max-h-[380px] w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm text-scanonix-muted">
            Preview unavailable
          </div>
        )}
      </div>
    </div>
  );
}
