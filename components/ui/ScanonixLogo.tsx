import Image from "next/image";

interface ScanonixLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function ScanonixLogo({
  size = 32,
  className = "",
  priority = false,
}: ScanonixLogoProps) {
  return (
    <Image
      src="/scanonix_icon.png"
      alt="Scanonix logo"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
