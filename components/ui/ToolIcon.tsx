interface ToolIconProps {
  type: string;
  className?: string;
}

export function ToolIcon({ type, className = "h-6 w-6" }: ToolIconProps) {
  const stroke = "currentColor";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "image-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="4" width="14" height="16" rx="2" />
          <path {...common} d="M7 8h6M7 12h8M7 16h5" />
          <path {...common} d="M17 14l4 4M17 18l4-4" />
        </svg>
      );
    case "pdf-image":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h8M8 15h5" />
          <circle {...common} cx="17" cy="17" r="3" />
        </svg>
      );
    case "merge":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="2" y="5" width="8" height="14" rx="1.5" />
          <rect {...common} x="14" y="5" width="8" height="14" rx="1.5" />
          <path {...common} d="M10 12h4M12 10v4" />
        </svg>
      );
    case "split":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="4" width="18" height="16" rx="2" />
          <path {...common} d="M12 4v16M8 8h2M14 8h2M8 16h2M14 16h2" />
        </svg>
      );
    case "rotate-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M4 12a8 8 0 0113.7-5.7M20 4v5h-5" />
          <rect {...common} x="6" y="6" width="12" height="16" rx="2" />
        </svg>
      );
    case "organize-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="4" width="7" height="9" rx="1.5" />
          <rect {...common} x="14" y="4" width="7" height="9" rx="1.5" />
          <rect {...common} x="3" y="15" width="7" height="5" rx="1.5" />
          <path {...common} d="M14 17h7M17.5 14.5v5" />
        </svg>
      );
    case "crop-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="7" y="5" width="10" height="14" rx="1.5" />
          <path {...common} d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
        </svg>
      );
    case "add-page-numbers":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="5" y="3" width="14" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h8M8 15h5" />
          <path {...common} d="M16 17h2M17 16v2" strokeWidth={2} />
        </svg>
      );
    case "fill-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="5" y="3" width="14" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h5" />
          <path {...common} d="M15 15l2 2 4-4" strokeWidth={2} />
        </svg>
      );
    case "sign-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h6" />
          <path {...common} d="M6 18c3-2 5-2 8 0 3-2 5-2 8 0" />
        </svg>
      );
    case "compress":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M8 3H3v5M16 3h5v5M16 21h5v-5M8 21H3v-5" />
          <rect {...common} x="7" y="7" width="10" height="10" rx="2" />
        </svg>
      );
    case "ocr":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 8h8M8 12h6M8 16h4" />
          <path {...common} d="M18 18l3 3" />
        </svg>
      );
    case "word":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M4 4h16v16H4z" />
          <path {...common} d="M7 8l2 8 2-6 2 6 2-8" />
        </svg>
      );
    case "convert":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M7 7h10v10H7z" />
          <path {...common} d="M4 12h3M17 12h3M12 4v3M12 17v3" />
        </svg>
      );
    case "bg-remove":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M4 4l16 16" />
        </svg>
      );
    case "qr":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="3" width="7" height="7" />
          <rect {...common} x="14" y="3" width="7" height="7" />
          <rect {...common} x="3" y="14" width="7" height="7" />
          <path {...common} d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
        </svg>
      );
    case "scan":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" />
          <rect {...common} x="7" y="7" width="10" height="10" rx="1" />
        </svg>
      );
    case "secure":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M12 3l8 4v6c0 5-3.5 8-8 8s-8-3-8-8V7l8-4z" />
          <path {...common} d="M9 12l2 2 4-4" />
        </svg>
      );
    case "manage":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M4 6h16M4 12h16M4 18h10" />
          <circle {...common} cx="18" cy="18" r="2" />
        </svg>
      );
    case "android":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M6 8l-2 3M18 8l2 3" />
          <rect {...common} x="5" y="8" width="14" height="11" rx="3" />
          <circle {...common} cx="9" cy="12" r="0.5" fill={stroke} />
          <circle {...common} cx="15" cy="12" r="0.5" fill={stroke} />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
          <path {...common} d="M9.5 12.5l1.8 1.8 3.7-3.8" />
        </svg>
      );
    case "protect-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="5" y="3" width="14" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h6" />
          <path {...common} d="M12 14v4M10 16h4" strokeWidth={2} />
          <path {...common} d="M9 16.5c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5" />
        </svg>
      );
    case "unlock-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="5" y="3" width="14" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h6" />
          <path {...common} d="M10 15h4M11 14v3" strokeWidth={2} />
          <path {...common} d="M10 14.5c0-1.2 1-2 2-2s2 .8 2 2" />
        </svg>
      );
    case "watermark-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h8" opacity="0.35" />
          <path {...common} d="M7 17l3-3 2 2 5-5" strokeWidth={2} />
        </svg>
      );
    case "redact-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h8M8 15h5" />
          <rect {...common} x="7" y="13" width="10" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.5" />
        </svg>
      );
    case "metadata-cleaner":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 7h8M8 11h6" />
          <path {...common} d="M15 16l4 4M19 16l-4 4" strokeWidth={2} />
        </svg>
      );
    case "pdf-to-word":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="4" width="10" height="14" rx="1.5" />
          <path {...common} d="M6 8h6M6 11h5" />
          <path {...common} d="M15 8h6v8h-6z" />
          <path {...common} d="M17 10l1.5 4 1.5-4 1.5 4" />
        </svg>
      );
    case "word-to-pdf":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M3 8h6v8H3z" />
          <path {...common} d="M5 10l1 4 1-2.5 1 2.5 1-4" />
          <rect {...common} x="11" y="4" width="10" height="14" rx="1.5" />
          <path {...common} d="M14 8h5M14 11h4" />
        </svg>
      );
    case "image-compress":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="5" width="16" height="14" rx="2" />
          <circle {...common} cx="9" cy="10" r="2" />
          <path {...common} d="M4 17l5-5 3 3 4-4 4 4" />
          <path {...common} d="M17 3v3M20 6h-3M7 21v-3M4 18h3" />
        </svg>
      );
    case "image-resize":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="6" y="6" width="12" height="12" rx="1.5" />
          <path {...common} d="M3 9V3h6M21 15v6h-6M3 15v6h6M21 9V3h-6" />
        </svg>
      );
    case "image-upscale":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="5" y="8" width="8" height="8" rx="1" />
          <rect {...common} x="11" y="4" width="10" height="10" rx="1.5" />
          <path {...common} d="M13 9l2 2 4-4" strokeWidth={2} />
        </svg>
      );
    case "png-to-jpg":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <text x="5" y="12" fill="currentColor" stroke="none" fontSize="5" fontWeight="700">P</text>
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <text x="14" y="17" fill="currentColor" stroke="none" fontSize="5" fontWeight="700">J</text>
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "jpg-to-png":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <text x="5" y="12" fill="currentColor" stroke="none" fontSize="5" fontWeight="700">J</text>
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <text x="14" y="17" fill="currentColor" stroke="none" fontSize="5" fontWeight="700">P</text>
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "png-to-webp":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <path {...common} d="M5 9h5M14 14h5" strokeWidth={1.5} />
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "jpg-to-webp":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <path {...common} d="M5 11h4M14 14h6" strokeWidth={1.5} />
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "webp-to-jpg":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <path {...common} d="M4 11h6M14 14h5" strokeWidth={1.5} />
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "webp-to-png":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <path {...common} d="M4 11h6M14 14h5" strokeWidth={1.5} />
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "heic-to-jpg":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <circle {...common} cx="7.5" cy="9.5" r="1.5" />
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <path {...common} d="M14 14h5" strokeWidth={1.5} />
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "heic-to-png":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="3" y="5" width="9" height="9" rx="1.5" />
          <circle {...common} cx="7.5" cy="9.5" r="1.5" />
          <rect {...common} x="12" y="10" width="9" height="9" rx="1.5" />
          <path {...common} d="M14 14h4" strokeWidth={1.5} />
          <path {...common} d="M12 9l2 2" />
        </svg>
      );
    case "ai-translate":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M4 5h8M4 9h5" />
          <path {...common} d="M6 5v8M10 5l-2 4" />
          <rect {...common} x="13" y="4" width="8" height="10" rx="1.5" />
          <path {...common} d="M15 7h4M15 10h3" />
          <path {...common} d="M8 17l2 2 4-4" strokeWidth={2} />
        </svg>
      );
    case "ai-summary":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="3" width="16" height="18" rx="2" />
          <path {...common} d="M8 8h8M8 12h6M8 16h4" />
          <path {...common} d="M17 6l1 1 2-2" strokeWidth={2} />
        </svg>
      );
    case "ai-rewrite":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path {...common} d="M4 6h12M4 10h8M4 14h10" />
          <path {...common} d="M16 8l4 4-4 4M18 12H10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
  }
}
