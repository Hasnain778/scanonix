import Image from "next/image";

interface ScanonixLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
  /**
   * `mark` = transparent standalone S (header / lockup).
   * `tile` = legacy black-tile raster (PDF reports, apple-style assets).
   */
  appearance?: "mark" | "tile";
}

export function ScanonixLogo({
  size = 32,
  className = "",
  priority = false,
  appearance = "mark",
}: ScanonixLogoProps) {
  const src = appearance === "tile" ? "/scanonix_icon.png" : "/scanonix_mark.png";

  return (
    <Image
      src={src}
      alt="Scanonix logo"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
