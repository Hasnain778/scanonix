import {
  FileSpreadsheet,
  FileText,
  Image,
  ScanLine,
  Sparkles,
} from "lucide-react";

const FLOATING_ICONS = [
  { Icon: FileText, label: "PDF", className: "home-hero-float home-hero-float-1 left-[8%] top-[18%]" },
  { Icon: FileText, label: "Word", className: "home-hero-float home-hero-float-2 left-[82%] top-[22%]" },
  { Icon: FileSpreadsheet, label: "Excel", className: "home-hero-float home-hero-float-3 left-[14%] top-[68%]" },
  { Icon: Image, label: "Image", className: "home-hero-float home-hero-float-4 right-[10%] top-[62%]" },
  { Icon: ScanLine, label: "OCR", className: "home-hero-float home-hero-float-5 left-[48%] top-[12%]" },
  { Icon: Sparkles, label: "AI", className: "home-hero-float home-hero-float-6 right-[18%] top-[78%]" },
] as const;

export function HeroFloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
      {FLOATING_ICONS.map(({ Icon, label, className }) => (
        <span
          key={label}
          className={`absolute hidden text-scanonix-orange/35 sm:block ${className}`}
        >
          <Icon className="h-7 w-7 stroke-[1.5] lg:h-8 lg:w-8" />
        </span>
      ))}
    </div>
  );
}
