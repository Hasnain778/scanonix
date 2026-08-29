interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  id?: string;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  id,
  className = "",
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";

  return (
    <div className={`max-w-3xl md:mb-16 ${alignClass} ${className}`}>
      {eyebrow && (
        <p className="mb-3 text-sm font-medium text-scanonix-orange">
          {eyebrow}
        </p>
      )}
      <h2
        id={id}
        className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-foreground-muted sm:text-lg md:mt-5">
          {description}
        </p>
      )}
    </div>
  );
}
