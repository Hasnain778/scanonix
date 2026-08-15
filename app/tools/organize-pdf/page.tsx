import { OrganizePdfTool } from "@/components/tools/organize-pdf/OrganizePdfTool";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("organize-pdf");

export default function OrganizePdfPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Organize PDF
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-scanonix-muted sm:text-base">
          Reorder, rotate, and remove pages from a PDF — processed locally in
          your browser.
        </p>
      </div>
      <OrganizePdfTool />
    </main>
  );
}
