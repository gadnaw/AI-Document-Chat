declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion?: string;
    Title?: string;
    Author?: string;
    Subject?: string;
    Producer?: string;
    Creator?: string;
    CreationDate?: string;
    ModDate?: string;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    text: string;
    version: string;
  }

  interface PDFParseFunction {
    (dataBuffer: Buffer | Uint8Array | ArrayBuffer): Promise<PDFData>;
  }

  const pdfParse: PDFParseFunction;
  export default pdfParse;
}
