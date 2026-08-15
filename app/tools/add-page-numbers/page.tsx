import { AddPageNumbersTool } from "@/components/tools/add-page-numbers/AddPageNumbersTool";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("add-page-numbers");

export default function AddPageNumbersPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Add Page Numbers
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-scanonix-muted sm:text-base">
          Add page numbers to PDF pages online with custom position, format,
          range, and starting number.
        </p>
      </div>
      <AddPageNumbersTool />
    </main>
  );
}
