import type { ImageConverterDefinition } from "@/constants/image-tools";

interface ConverterToolExtrasProps {
  config: ImageConverterDefinition;
}

export function ConverterToolExtras({ config }: ConverterToolExtrasProps) {
  return (
    <div className="mt-8 border-t border-white/10 pt-8">
      <section>
        <h2 className="text-lg font-semibold text-white">Supported formats</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-scanonix-muted">
          Upload {config.acceptExtensions.replaceAll(",", ", ")} files. Output format:{" "}
          {config.outputLabel}. Processing runs locally in your browser whenever possible.
        </p>
      </section>
    </div>
  );
}
