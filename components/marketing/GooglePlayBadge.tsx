import Image from "next/image";

const BADGE_SRC = "/assets/google-play/en_badge_web_generic.png";

/** Official “Get it on Google Play” badge per Google Play brand guidelines. */
export function GooglePlayBadge({
  height = 44,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={BADGE_SRC}
      alt="Get Scanonix on Google Play"
      width={646}
      height={250}
      className={`w-auto max-w-full ${className}`}
      style={{ height, width: "auto" }}
    />
  );
}
