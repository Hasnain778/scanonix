import type { ReactNode, SVGProps } from "react";
import type { CanvasPresetFamily } from "@/lib/image-editor/presets";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Base({
  title,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function InstagramBrandIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <defs>
        <linearGradient id="ig-g" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f58529" />
          <stop offset="50%" stopColor="#dd2a7b" />
          <stop offset="100%" stopColor="#8134af" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-g)" />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="#fff" strokeWidth="1.75" />
      <circle cx="17.35" cy="6.65" r="1.15" fill="#fff" />
    </Base>
  );
}

export function FacebookBrandIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#1877F2" />
      <path
        fill="#fff"
        d="M13.5 20v-6.2h2.1l.3-2.4h-2.4V9.9c0-.7.2-1.2 1.2-1.2h1.3V6.2c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.9H8.6v2.4h2.3V20h2.6z"
      />
    </Base>
  );
}

export function YouTubeBrandIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <rect x="1.5" y="5" width="21" height="14" rx="3.5" fill="#FF0000" />
      <path fill="#fff" d="M10 9.2v5.6l5-2.8-5-2.8z" />
    </Base>
  );
}

export function XBrandIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#000" />
      <path
        fill="#fff"
        d="M16.6 7h1.5l-3.3 3.8L19 17h-3.1l-2.4-3.2L10.6 17H9.1l3.5-4L8 7h3.2l2.2 2.9L16.6 7zm-.5 9h.8L10.9 8h-.9l5.1 8z"
      />
    </Base>
  );
}

export function LinkedInBrandIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.2 9.7h2.1V17H7.2V9.7zM8.2 7a1.2 1.2 0 110 2.4A1.2 1.2 0 018.2 7zM11.2 9.7h2v1h0c.3-.5 1-1.1 2.1-1.1 2.2 0 2.6 1.5 2.6 3.4V17h-2.1v-3.3c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.8V17h-2.1V9.7z"
      />
    </Base>
  );
}

export function TikTokBrandIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#010101" />
      <path
        fill="#25F4EE"
        d="M15.2 7.2c.7.7 1.6 1.2 2.6 1.3V10c-1.2 0-2.3-.4-3.2-1.1v4.6a4.1 4.1 0 11-4.1-4.1c.2 0 .4 0 .6.1v1.9a2.2 2.2 0 100 4.3 2.2 2.2 0 002.2-2.2V5.5h1.9v1.7z"
      />
      <path
        fill="#FE2C55"
        d="M14.8 6.8c.7.7 1.6 1.2 2.6 1.3V8.8c-1.2 0-2.3-.4-3.2-1.1v4.6a4.1 4.1 0 11-4.1-4.1c.2 0 .4 0 .6.1v1.9a2.2 2.2 0 100 4.3 2.2 2.2 0 002.2-2.2V5.1h1.9v1.7z"
        opacity="0.85"
      />
      <path
        fill="#fff"
        d="M14.4 6.4c.7.7 1.6 1.2 2.6 1.3V8.4c-1.2 0-2.3-.4-3.2-1.1v4.6a4.1 4.1 0 11-4.1-4.1c.2 0 .4 0 .6.1v1.9a2.2 2.2 0 100 4.3 2.2 2.2 0 002.2-2.2V4.7h1.9v1.7z"
      />
    </Base>
  );
}

export function GeneralCanvasIcon(props: IconProps) {
  return (
    <Base {...props} title={props.title}>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 14l4.5-3.5 3.5 2.5 4-4.5L21 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="8.5" r="1.4" fill="currentColor" />
    </Base>
  );
}

const FAMILY_TITLES: Partial<Record<CanvasPresetFamily, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  general: "General",
};

export function PlatformBrandIcon({
  family,
  className,
  decorative = true,
}: {
  family: CanvasPresetFamily;
  className?: string;
  /** When true (default), hide from a11y tree — use next to a visible label. */
  decorative?: boolean;
}) {
  const common: IconProps = {
    className: className ?? "h-4 w-4 shrink-0",
    ...(decorative
      ? { "aria-hidden": true as const }
      : { title: FAMILY_TITLES[family] }),
  };
  switch (family) {
    case "instagram":
      return <InstagramBrandIcon {...common} />;
    case "facebook":
      return <FacebookBrandIcon {...common} />;
    case "youtube":
      return <YouTubeBrandIcon {...common} />;
    case "x":
      return <XBrandIcon {...common} />;
    case "linkedin":
      return <LinkedInBrandIcon {...common} />;
    case "tiktok":
      return <TikTokBrandIcon {...common} />;
    case "general":
    case "custom":
    default:
      return <GeneralCanvasIcon {...common} />;
  }
}
