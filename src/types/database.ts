/**
 * Database Types for Document Storage
 * TypeScript interfaces for database schema and operations
 */

/**
 * Document status enum
 */
export type DocumentStatus =
  | 'pending'      // Waiting to be processed
  | 'processing'   // Currently being processed
  | 'complete'     // Successfully processed
  | 'error'        // Failed during processing
  | 'skipped'      // Skipped due to duplicate detection';

/**
 * File status enum (extended from upload types)
 */
export type FileProcessingStatus =
  | 'pending'      // Waiting to be processed
  | 'parsing'      // Extracting text from PDF
  | 'chunking'     // Creating text chunks
  | 'embedding'    // Generating embeddings
  | 'complete'     // Successfully processed
  | 'error'        // Failed during processing
  | 'skipped';     // Skipped due to duplicate detection

/**
 * Document record interface
 */
export interface DocumentRecord {
  /** Unique document identifier */
  id: string;
  /** Session identifier */
  session_id: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  file_size: number;
  /** Number of pages in the document */
  page_count: number;
  /** Number of chunks created */
  chunk_count: number;
  /** Current processing status */
  status: DocumentStatus;
  /** Error message if status is 'error' */
  error_message?: string;
  /** When the document was created */
  created_at: Date;
  /** When processing completed (if applicable) */
  completed_at?: Date;
  /** Additional metadata */
  metadata?: {
    title?: string;
    author?: string;
    creationDate?: Date;
    sha256?: string;
  };
}

/**
 * Document chunk record interface
 */
export interface DocumentChunkRecord {
  /** Unique chunk identifier */
  id: string;
  /** Parent document ID */
  document_id: string;
  /** Chunk order index */
  chunk_index: number;
  /** Text content of the chunk */
  chunk_text: string;
  /** Embedding vector (pgvector) */
  embedding: number[];
  /** Chunk metadata */
  metadata: {
    /** Estimated token count */
    tokens: number;
    /** Source page number (if available) */
    pageNumber?: number;
    /** Character count */
    chunkSize: number;
  };
  /** When the chunk was created */
  created_at: Date;
}

/**
 * Processing session interface
 */
export interface ProcessingSession {
  /** Session identifier */
  id: string;
  /** User ID who owns this session */
  user_id: string;
  /** Current processing status */
  status: 'active' | 'completed' | 'error';
  /** Number of files processed */
  files_processed: number;
  /** Number of files with errors */
  files_error: number;
  /** When the session was created */
  created_at: Date;
  /** When the session was completed */
  completed_at?: Date;
}

/**
 * Upload session interface (extended from upload types)
 */
export interface UploadSession {
  /** Session identifier */
  id: string;
  /** User ID who owns this session */
  user_id: string;
  /** Current processing status */
  status: 'uploading' | 'processing' | 'completed' | 'error';
  /** Total files in session */
  total_files: number;
  /** Files successfully processed */
  processed_files: number;
  /** Files with errors */
  error_files: number;
  /** When the session was created */
  created_at: Date;
  /** When processing completed */
  completed_at?: Date;
}

/**
 * Progress tracking interface
 */
export interface ProgressTracking {
  /** Session identifier */
  session_id: string;
  /** Current file being processed */
  current_file_id?: string;
  /** Current processing stage */
  current_stage: FileProcessingStatus;
  /** Overall progress percentage (0-100) */
  overall_progress: number;
  /** Current file progress percentage (0-100) */
  file_progress: number;
  /** Processing start time */
  started_at: Date;
  /** Last update time */
  updated_at: Date;
}

/**
 * Database query result interfaces
 */
export interface DocumentQueryResult {
  /** Document record if found */
  data: DocumentRecord | null;
  /** Query error if any */
  error: string | null;
}

export interface DocumentsQueryResult {
  /** Array of document records */
  data: DocumentRecord[];
  /** Query error if any */
  error: string | null;
}

export interface ChunksQueryResult {
  /** Array of chunk records */
  data: DocumentChunkRecord[];
  /** Query error if any */
  error: string | null;
}

export interface CountQueryResult {
  /** Count of matching records */
  count: number;
  /** Query error if any */
  error: string | null;
}

/**
 * Storage operation result interfaces
 */
export interface InsertResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Inserted record data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
}

export interface UpdateResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Number of records updated */
  updated: number;
  /** Error message if failed */
  error?: string;
}

export interface DeleteResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Number of records deleted */
  deleted: number;
  /** Error message if failed */
  error?: string;
}

/**
 * pgvector similarity search result
 */
export interface SimilaritySearchResult {
  /** Chunk record */
  chunk: DocumentChunkRecord;
  /** Similarity score (0-1) */
  similarity: number;
}

/**
 * Vector storage configuration
 */
export interface VectorStorageConfig {
  /** Table name for documents */
  documentsTable: string;
  /** Table name for chunks */
  chunksTable: string;
  /** Embedding column name */
  embeddingColumn: string;
  /** Similarity search function */
  similarityFunction: 'cosine_distance' | 'inner_product' | 'euclidean_distance';
}

/**
 * Default vector storage configuration
 */
export const defaultVectorStorageConfig: VectorStorageConfig = {
  documentsTable: 'documents',
  chunksTable: 'document_chunks',
  embeddingColumn: 'embedding',
  similarityFunction: 'cosine_distance',
};
