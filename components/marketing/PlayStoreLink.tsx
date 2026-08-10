import { type AnchorHTMLAttributes, type ReactNode } from "react";
import { PLAY_STORE_URL } from "@/config/site";
import { GooglePlayBadge } from "@/components/marketing/GooglePlayBadge";
import { GooglePlayMark } from "@/components/marketing/GooglePlayMark";

type PlayStoreLinkProps = {
  children?: ReactNode;
  /** Tracking location slug, e.g. hero, navbar, promo-section */
  location: string;
  className?: string;
  /** text-with-mark: compact official mark + label; badge: full official Google Play badge */
  variant?: "text-with-mark" | "badge";
  markSize?: number;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

export function PlayStoreLink({
  children,
  location,
  className = "",
  variant = "text-with-mark",
  markSize = 18,
  ...props
}: PlayStoreLinkProps) {
  const ariaLabel =
    variant === "badge"
      ? "Get Scanonix on Google Play"
      : typeof children === "string"
        ? `Get Scanonix on Google Play — ${children}`
        : "Get Scanonix on Google Play for Android";

  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant === "badge"
          ? className
          : `inline-flex items-center justify-center gap-3 ${className}`
      }
      data-track="android-app-cta"
      data-track-location={location}
      aria-label={ariaLabel}
      {...props}
    >
      {variant === "badge" ? (
        <GooglePlayBadge height={44} />
      ) : (
        <>
          <GooglePlayMark size={markSize} />
          {children ? <span>{children}</span> : null}
        </>
      )}
    </a>
  );
}
