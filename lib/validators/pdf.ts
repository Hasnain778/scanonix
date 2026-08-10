export {
  isAcceptedPdfFile,
  ACCEPTED_PDF_TYPE,
  ACCEPTED_PDF_EXTENSION,
} from "@/lib/pdf/core";

export function validatePdfFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return "Please upload a PDF file.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  return null;
}

export function validatePdfSize(file: File, maxMb = 100): string | null {
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `File exceeds the ${maxMb} MB limit.`;
  }
  return null;
}
