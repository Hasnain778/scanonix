export function BackgroundRemoverPrivacyNotice() {
  return (
    <p className="text-center text-xs leading-relaxed text-scanonix-muted">
      Your image is processed entirely in your browser using a local AI model.
      The file is never uploaded to a Scanonix server. On first use, model files
      are downloaded and cached for faster future conversions.
    </p>
  );
}
