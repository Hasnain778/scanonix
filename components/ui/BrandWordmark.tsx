interface BrandWordmarkProps {
  className?: string;
  size?: "header" | "footer";
}

const SIZE_CLASSES = {
  header: "text-[21px] sm:text-[24px] md:text-[27px] lg:text-[30px]",
  footer: "text-xl",
} as const;

export function BrandWordmark({ className = "", size = "header" }: BrandWordmarkProps) {
  return (
    <span
      className={`inline-block whitespace-nowrap font-extrabold leading-none tracking-[-0.03em] ${SIZE_CLASSES[size]} ${className}`}
    >
      <span className="text-foreground">SCAN</span>
      <span className="text-scanonix-orange">ONIX</span>
    </span>
  );
}
