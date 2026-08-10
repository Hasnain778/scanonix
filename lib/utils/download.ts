import JSZip from "jszip";
import type { NamedBlobOutput } from "@/types/tool";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function createPdfFilename(prefix = "scanonix"): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `${prefix}-${timestamp}.pdf`;
}

export async function packageOutputsForDownload(
  outputs: NamedBlobOutput[],
  zipFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  if (outputs.length === 0) {
    throw new Error("No files were generated");
  }

  if (outputs.length === 1) {
    return { blob: outputs[0].blob, filename: outputs[0].filename };
  }

  const zip = new JSZip();
  outputs.forEach((output) => {
    zip.file(output.filename, output.blob);
  });

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return { blob: zipBlob, filename: zipFilename };
}

export async function downloadOutputs(
  outputs: NamedBlobOutput[],
  zipFilename: string,
): Promise<void> {
  const { blob, filename } = await packageOutputsForDownload(
    outputs,
    zipFilename,
  );
  downloadBlob(blob, filename);
}
