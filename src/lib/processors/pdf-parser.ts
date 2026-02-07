/**
 * PDF Text Extraction Processor
 * LangChain.js PDFLoader-based extraction with error handling
 */

import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { Document } from 'langchain/document';

/**
 * Result interface for text extraction
 */
export interface TextExtractionResult {
  /** Full extracted text content */
  text: string;
  /** Number of pages in the PDF */
  pages: number;
  /** Estimated number of chunks for progress tracking */
  chunks: number;
  /** PDF metadata */
  metadata: {
    title?: string;
    author?: string;
    creationDate?: Date;
  };
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * PDF metadata interface
 */
export interface PDFMetadata {
  title?: string;
  author?: string;
  creationDate?: Date;
  pageCount: number;
}

/**
 * PDF Parser using LangChain.js PDFLoader
 * Extracts text content from PDF files with error handling
 */
export class PDFParser {
  /**
   * Extract text from a PDF file
   * @param filePath - Path to the PDF file
   * @param fileId - Unique identifier for this file
   * @returns Promise resolving to TextExtractionResult
   */
  async extractText(filePath: string, fileId: string): Promise<TextExtractionResult> {
    try {
      // Load PDF using LangChain's PDFLoader
      const loader = new PDFLoader(filePath);
      const docs: Document[] = await loader.load();

      // Extract text content from all pages
      const textContent = docs.map((doc) => doc.pageContent).join('\n\n');

      // Handle empty PDF
      if (!textContent.trim()) {
        return {
          text: '',
          pages: docs.length,
          chunks: 0,
          metadata: {
            title: this.extractFileName(filePath),
          },
        };
      }

      // Extract metadata from the first page
      const metadata = this.extractMetadata(docs);

      // Calculate estimated chunks (500 tokens per chunk, ~750 chars)
      const estimatedChunks = Math.ceil(textContent.length / 750);

      return {
        text: textContent,
        pages: docs.length,
        chunks: estimatedChunks,
        metadata,
      };
    } catch (error) {
      // Handle specific error types with user-friendly messages
      if (this.isPasswordProtectedError(error)) {
        throw new Error('Cannot process password-protected PDF');
      }

      if (this.isCorruptedError(error)) {
        throw new Error('File appears to be corrupted');
      }

      // Generic error with simplified message
      throw new Error('Unable to extract text from PDF');
    }
  }

  /**
   * Validate PDF file structure
   * @param file - File object to validate
   * @returns Promise resolving to ValidationResult
   */
  async validatePDF(file: File): Promise<ValidationResult> {
    try {
      // Check file type
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        return { valid: false, error: 'File must be a PDF document' };
      }

      // Check file size (max 50MB per requirements)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        return { valid: false, error: 'File size exceeds maximum limit' };
      }

      // Basic PDF structure validation could be added here
      // For now, we rely on the extraction to catch structural issues

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Unable to validate PDF file' };
    }
  }

  /**
   * Get page count without full text extraction
   * @param filePath - Path to the PDF file
   * @returns Promise resolving to page count
   */
  async getPageCount(filePath: string): Promise<number> {
    try {
      const loader = new PDFLoader(filePath);
      const docs: Document[] = await loader.load();
      return docs.length;
    } catch (error) {
      // If we can't get page count, return 0
      console.error('Failed to get page count:', error);
      return 0;
    }
  }

  /**
   * Extract PDF metadata
   * @param filePath - Path to the PDF file
   * @returns Promise resolving to PDFMetadata
   */
  async getMetadata(filePath: string): Promise<PDFMetadata> {
    try {
      const loader = new PDFLoader(filePath);
      const docs: Document[] = await loader.load();

      if (docs.length === 0) {
        return {
          title: this.extractFileName(filePath),
          pageCount: 0,
        };
      }

      // Extract metadata from the first page's metadata
      const firstDoc = docs[0];
      const metadata = firstDoc.metadata || {};

      return {
        title: (metadata.title as string) || this.extractFileName(filePath),
        author: metadata.author as string,
        creationDate: metadata.creationDate ? new Date(metadata.creationDate as string) : undefined,
        pageCount: docs.length,
      };
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      return {
        title: this.extractFileName(filePath),
        pageCount: 0,
      };
    }
  }

  /**
   * Extract filename from path
   */
  private extractFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Extract metadata from loaded documents
   */
  private extractMetadata(docs: Document[]): PDFMetadata {
    if (docs.length === 0) {
      return { pageCount: 0 };
    }

    const firstDoc = docs[0];
    const metadata = firstDoc.metadata || {};

    return {
      title: (metadata.title as string) || this.extractFileName(firstDoc.metadata?.source as string || 'unknown'),
      author: metadata.author as string,
      creationDate: metadata.creationDate ? new Date(metadata.creationDate as string) : undefined,
    };
  }

  /**
   * Check if error indicates password protection
   */
  private isPasswordProtectedError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.toLowerCase().includes('password') ||
      errorMessage.toLowerCase().includes('encrypted') ||
      errorMessage.toLowerCase().includes('decrypt')
    );
  }

  /**
   * Check if error indicates corrupted file
   */
  private isCorruptedError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.toLowerCase().includes('corrupt') ||
      errorMessage.toLowerCase().includes('invalid') ||
      errorMessage.toLowerCase().includes('malformed') ||
      errorMessage.toLowerCase().includes('parse')
    );
  }
}

// Export singleton instance for easy use
export const pdfParser = new PDFParser();
