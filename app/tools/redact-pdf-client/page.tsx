import type { Metadata } from "next";
import { RedactPdfProClientTool } from "@/components/tools/redact-pdf-client/RedactPdfProClientTool";

export const metadata: Metadata = {
  title: "Redact PDF (Client Test)",
  description: "Local test workspace for client-side secure PDF redaction.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RedactPdfClientPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Redact PDF (Client Test)
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-scanonix-muted sm:text-base">
          Draw redaction areas directly on your PDF — processed locally in your
          browser using the secure hybrid rasterization engine. Pro access
          required to export.
        </p>
      </div>
      <RedactPdfProClientTool />
    </main>
  );
}
