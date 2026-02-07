/**
 * Type definitions for the retrieval system
 * Provides type-safe interfaces for search results and retrieval operations
 */

/**
 * Core result interface for retrieval responses
 * Contains all information needed for RAG context and citation display
 */
export interface SearchResult {
  /** chunk UUID from document_chunks */
  id: string;
  /** parent document UUID */
  documentId: string;
  /** from documents.name for citation display */
  documentName: string;
  /** position in document for ordering */
  chunkIndex: number;
  /** chunk text content */
  content: string;
  /** cosine similarity (0-1 range) */
  similarityScore: number;
  /** optional page reference from PDF */
  pageNumber?: number;
  /** additional citation data */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration options for retrieval operations
 */
export interface RetrievalOptions {
  /** number of results to return (default: 5, range: 1-20) */
  topK?: number;
  /** minimum similarity threshold (default: 0.7, range: 0.0-1.0) */
  threshold?: number;
  /** required: user ID for RLS enforcement */
  userId: string;
  /** optional: filter to specific documents */
  documentIds?: string[];
}

/**
 * Raw database result before transformation
 * Maps directly to database column names
 */
interface RawSearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number;
  metadata?: Record<string, unknown>;
  document_name: string;
  /** distance from pgvector (<=) */
  similarity: number;
}
