import type { Metadata } from "next";
import { WatermarkPdfClientTool } from "@/components/tools/watermark-pdf-client/WatermarkPdfClientTool";

export const metadata: Metadata = {
  title: "Watermark PDF (Client Test)",
  description: "Local test workspace for client-side PDF watermarking.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WatermarkPdfClientPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Watermark PDF (Client Test)
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-scanonix-muted sm:text-base">
          Add text or image watermarks locally in your browser — internal test route.
        </p>
      </div>
      <WatermarkPdfClientTool />
    </main>
  );
}
