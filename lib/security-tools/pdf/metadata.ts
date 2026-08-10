import { PDFDocument } from "pdf-lib";

export async function cleanPdfMetadata(buffer: Buffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("");
  pdfDoc.setCreator("");
  pdfDoc.setCreationDate(new Date(0));
  pdfDoc.setModificationDate(new Date(0));

  return pdfDoc.save();
}
