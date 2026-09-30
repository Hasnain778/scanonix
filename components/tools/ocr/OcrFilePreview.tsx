interface OcrFilePreviewProps {
  fileName: string;
  previewUrl: string | null;
  isPdf: boolean;
}

export function OcrFilePreview({
  fileName,
  previewUrl,
  isPdf,
}: OcrFilePreviewProps) {
  return (
    <div className="ocr-preview">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={isPdf ? "PDF first page preview" : fileName}
          className="ocr-preview-image"
        />
      ) : (
        <div className="ocr-preview-empty">Preview unavailable</div>
      )}
    </div>
  );
}
