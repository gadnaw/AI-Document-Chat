/**
 * Document Ingestion Types
 * Type definitions for document processing and chunking
 */

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
}

export interface DocumentMetadata {
  source: string;
  filename: string;
  fileType: string;
  chunkIndex: number;
  totalChunks: number;
  createdAt: Date;
}

export interface ProcessedDocument {
  id: string;
  filename: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  processingTime: number;
}

export interface IngestionConfig {
  chunkSize: number;
  chunkOverlap: number;
  embeddingsModel: string;
  maxRetries: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
}

export interface PDFProcessingResult {
  text: string;
  numPages: number;
  metadata: {
    PDFFormatVersion: string;
    Title?: string;
    Author?: string;
    Subject?: string;
    Producer?: string;
    Creator?: string;
    CreationDate?: string;
    ModDate?: string;
  };
}
