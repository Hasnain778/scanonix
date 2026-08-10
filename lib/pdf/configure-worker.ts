let workerConfigured = false;

/**
 * Configure PDF.js to load its worker from the bundled npm package — never from a CDN.
 * Safe to call multiple times; only runs once per page load.
 */
export async function configurePdfWorker(): Promise<void> {
  if (workerConfigured || typeof window === "undefined") {
    return;
  }

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  workerConfigured = true;
}
