interface PrivacyNoticeProps {
  message?: string;
}

export function PrivacyNotice({
  message = "Your files are processed locally in your browser and never uploaded to any server. Scanonix does not store or access your documents.",
}: PrivacyNoticeProps) {
  return (
    <p className="text-center text-xs leading-relaxed text-scanonix-muted">
      {message}
    </p>
  );
}
