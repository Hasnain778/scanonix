import Image from "next/image";

const MARK_SRC = "/assets/google-play/google-play-mark.png";

/** Official Google Play triangle mark at original colors (compact navigation / hero). */
export function GooglePlayMark({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={MARK_SRC}
      alt=""
      width={48}
      height={48}
      aria-hidden
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
