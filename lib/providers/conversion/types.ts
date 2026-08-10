export interface DocumentConversionProvider {
  convertPdfToDocx(input: Buffer, fileName: string): Promise<Buffer>;
  convertDocxToPdf(input: Buffer, fileName: string): Promise<Buffer>;
}

export class DocumentConversionNotConfiguredError extends Error {
  constructor() {
    super("Document conversion service is not configured.");
    this.name = "DocumentConversionNotConfiguredError";
  }
}
