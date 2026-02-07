/**
 * PDF Processing Utilities
 * PDF text extraction and preprocessing for document ingestion
 */

import { PDFProcessingResult } from './types';

/**
 * Extract text content from a PDF file
 * @param file - File object or buffer containing PDF data
 * @returns Promise resolving to extracted text and metadata
 */
export async function extractTextFromPDF(file: File | Buffer): Promise<PDFProcessingResult> {
  // Dynamic import of pdf-parse to handle browser/server compatibility
  const pdfParse = (await import('pdf-parse')).default;

  const buffer = file instanceof File
    ? await file.arrayBuffer().then(buffer => Buffer.from(buffer))
    : file;

  const data = await pdfParse(buffer);

  return {
    text: cleanExtractedText(data.text),
    numPages: data.numpages,
    metadata: {
      PDFFormatVersion: data.version || '1.5',
      Title: data.info?.Title,
      Author: data.info?.Author,
      Subject: data.info?.Subject,
      Producer: data.info?.Producer,
      Creator: data.info?.Creator,
      CreationDate: data.info?.CreationDate,
      ModDate: data.info?.ModDate,
    },
  };
}

/**
 * Clean extracted PDF text
 * Removes excessive whitespace, fixes common PDF extraction issues
 */
export function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines (more than 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Fix hyphenation at line breaks
    .replace(/(\w+)-\n(\w+)/g, '$1$2')
    // Remove page numbers and common artifacts
    .replace(/\n\s*\d+\s*\n/g, '\n')
    // Fix spacing around punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Normalize multiple spaces to single space
    .replace(/[ \t]+/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Split text into chunks with configurable size and overlap
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number := 200
): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // Calculate chunk end position
    let endIndex = startIndex + chunkSize;

    // If not at the end, try to split at a natural boundary
    if (endIndex < text.length) {
      // Look for sentence endings nearby
      const sentenceEnd = text.indexOf('. ', endIndex - 100);
      const paragraphEnd = text.indexOf('\n\n', endIndex - 200);

      // Prefer sentence endings, then paragraph endings
      if (sentenceEnd !== -1 && sentenceEnd < endIndex + 100) {
        endIndex = sentenceEnd + 1;
      } else if (paragraphEnd !== -1 && paragraphEnd < endIndex + 50) {
        endIndex = paragraphEnd;
      } else {
        // Split at word boundary
        const lastSpace = text.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex && lastSpace < endIndex) {
          endIndex = lastSpace;
        }
      }
    }

    // Extract chunk and add to list
    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start index with overlap
    startIndex = endIndex - chunkOverlap;
    if (startIndex < 0) startIndex = 0;

    // Avoid infinite loops
    if (chunks.length > 1000) break;
  }

  return chunks;
}

/**
 * Validate file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
