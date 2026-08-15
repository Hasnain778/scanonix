import { FillPdfTool } from "@/components/tools/fill-pdf/FillPdfTool";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("fill-pdf");

export default function FillPdfPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Fill PDF Form
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-scanonix-muted sm:text-base">
          Fill AcroForm PDF fields online — processed locally in your browser.
        </p>
      </div>
      <FillPdfTool />
    </main>
  );
}
