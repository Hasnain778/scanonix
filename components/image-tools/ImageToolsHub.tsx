import { FileOutput, Layers, ScanLine, WandSparkles } from "lucide-react";
import {
  getConverterBySlug,
  IMAGE_CONVERTERS,
  IMAGE_HUB_EDIT_TOOLS,
  IMAGE_HUB_FEATURED_MEDIUM,
  IMAGE_HUB_PDF_RELATED,
} from "@/constants/image-tools";
import { ConverterGridCard } from "@/components/image-tools/ConverterGridCard";
import {
  FeaturedBackgroundRemoverCard,
  MediumConverterCard,
} from "@/components/image-tools/FeaturedBackgroundRemoverCard";
import { HubToolLink } from "@/components/image-tools/HubToolLink";
import { ImageToolIconBox } from "@/components/image-tools/ImageToolIconBox";

const EDIT_ICONS = {
  "background-remover": WandSparkles,
  "qr-scanner": ScanLine,
} as const;

const PDF_ICONS = {
  "image-to-pdf": FileOutput,
  "pdf-to-image": FileOutput,
  ocr: FileOutput,
} as const;

export function ImageToolsHub() {
  const featuredMedium = IMAGE_HUB_FEATURED_MEDIUM.map((slug) => getConverterBySlug(slug)).filter(
    (item): item is NonNullable<typeof item> => item !== undefined,
  );

  return (
    <div className="space-y-16 sm:space-y-20">
      <header className="max-w-3xl">
        <p className="mb-3 text-xs font-medium tracking-wide text-scanonix-orange">Image workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Image Tools</h1>
        <p className="mt-4 text-base leading-relaxed text-foreground-muted sm:text-lg">
          Convert, clean up, and prepare images with professional utilities. Local processing wherever
          possible.
        </p>
      </header>

      <section aria-labelledby="featured-tools-heading">
        <h2 id="featured-tools-heading" className="mb-6 text-lg font-semibold text-foreground">
          Featured tools
        </h2>
        <div className="grid gap-4 lg:grid-cols-5 lg:gap-5">
          <div className="lg:col-span-3">
            <FeaturedBackgroundRemoverCard />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
            {featuredMedium.map((converter) => (
              <MediumConverterCard
                key={converter.slug}
                slug={converter.slug}
                title={converter.title}
                description={converter.shortDescription}
                fromLabel={converter.from.toUpperCase()}
                toLabel={converter.to === "jpg" ? "JPG" : converter.to.toUpperCase()}
                badge={converter.badge}
              />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="convert-images-heading">
        <div className="mb-6 flex items-center gap-3">
          <ImageToolIconBox icon={Layers} />
          <div>
            <h2 id="convert-images-heading" className="text-lg font-semibold text-foreground">
              Convert images
            </h2>
            <p className="text-sm text-foreground-muted">All format converters run in your browser</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {IMAGE_CONVERTERS.map((converter) => (
            <ConverterGridCard key={converter.slug} converter={converter} />
          ))}
        </div>
      </section>

      <section aria-labelledby="edit-enhance-heading">
        <h2 id="edit-enhance-heading" className="mb-6 text-lg font-semibold text-foreground">
          Edit &amp; enhance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMAGE_HUB_EDIT_TOOLS.map((tool) => {
            const Icon = EDIT_ICONS[tool.id as keyof typeof EDIT_ICONS] ?? WandSparkles;
            return <HubToolLink key={tool.id} tool={tool} icon={Icon} />;
          })}
        </div>
      </section>

      <section aria-labelledby="related-pdf-heading">
        <h2 id="related-pdf-heading" className="mb-6 text-lg font-semibold text-foreground">
          Related PDF tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IMAGE_HUB_PDF_RELATED.map((tool) => {
            const Icon = PDF_ICONS[tool.id as keyof typeof PDF_ICONS] ?? FileOutput;
            return <HubToolLink key={tool.id} tool={tool} icon={Icon} />;
          })}
        </div>
      </section>
    </div>
  );
}
