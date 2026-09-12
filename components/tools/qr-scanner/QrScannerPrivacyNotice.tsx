export function QrScannerPrivacyNotice() {
  return (
    <p className="text-center text-xs leading-relaxed text-foreground-muted">
      QR codes are decoded locally in your browser. Camera frames and uploaded
      images are not sent to Scanonix for decoding. The jsQR decoder is bundled
      locally with this tool.
    </p>
  );
}
