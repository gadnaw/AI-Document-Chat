/**
 * pgvector Storage Processor
 * Database operations for document chunks and embeddings
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TextExtractionResult } from './pdf-parser';
import { ChunkResult } from './chunker';
import { EmbeddingResult } from './embedder';
import { UploadFile } from '@/types/upload';

/**
 * Storage result interface
 */
export interface StorageResult {
  success: boolean;
  documentId?: string;
  chunksStored: number;
  error?: string;
}

/**
 * Document status enum
 */
export type DocumentStatus = 'processing' | 'complete' | 'error';

/**
 * Chunk record interface for database storage
 */
export interface ChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  metadata: {
    tokens: number;
    pageNumber?: number;
    chunkSize: number;
  };
  created_at: Date;
}

/**
 * Document record interface
 */
export interface DocumentRecord {
  id: string;
  filename: string;
  file_size: number;
  page_count: number;
  chunk_count: number;
  status: DocumentStatus;
  error_message?: string;
  created_at: Date;
  completed_at?: Date;
}

/**
 * pgvector Storage service
 * Handles database operations for documents and chunks
 */
export class VectorStorage {
  /** Supabase client instance */
  private client: SupabaseClient | null = null;
  /** Singleton instance */
  private static instance: VectorStorage;

  /**
   * Get singleton instance
   */
  static getInstance(): VectorStorage {
    if (!VectorStorage.instance) {
      VectorStorage.instance = new VectorStorage();
    }
    return VectorStorage.instance;
  }

  /**
   * Initialize or get the Supabase client
   */
  private getClient(): SupabaseClient {
    if (!this.client) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables are not configured');
      }

      this.client = createClient(supabaseUrl, supabaseKey);
    }

    return this.client;
  }

  /**
   * Store embeddings and chunks in the database
   * @param documentId - Unique document identifier
   * @param chunks - Chunking result
   * @param embeddings - Embedding generation result
   * @returns Promise resolving to StorageResult
   */
  async storeEmbeddings(
    documentId: string,
    chunks: ChunkResult,
    embeddings: EmbeddingResult
  ): Promise<StorageResult> {
    try {
      const client = this.getClient();

      // Validate inputs
      if (!documentId) {
        return { success: false, chunksStored: 0, error: 'Document ID is required' };
      }

      if (chunks.chunks.length !== embeddings.embeddings.length) {
        return {
          success: false,
          chunksStored: 0,
          error: 'Chunk and embedding count mismatch',
        };
      }

      if (chunks.chunks.length === 0) {
        return { success: false, chunksStored: 0, error: 'No chunks to store' };
      }

      // Prepare chunk records for insertion
      const chunkRecords = chunks.chunks.map((chunkText, index) => ({
        document_id: documentId,
        chunk_index: index,
        chunk_text: chunkText,
        embedding: embeddings.embeddings[index],
        metadata: {
          tokens: this.estimateTokens(chunkText),
          chunkSize: chunkText.length,
        },
        created_at: new Date().toISOString(),
      }));

      // Insert all chunks in a single transaction
      const { data, error } = await client
        .from('document_chunks')
        .insert(chunkRecords)
        .select();

      if (error) {
        console.error('Failed to store chunks:', error);
        return {
          success: false,
          chunksStored: 0,
          error: 'Failed to store document chunks',
        };
      }

      return {
        success: true,
        documentId,
        chunksStored: data.length,
      };
    } catch (error) {
      console.error('Storage error:', error);
      return {
        success: false,
        chunksStored: 0,
        error: 'Database operation failed',
      };
    }
  }

  /**
   * Update document status in the database
   * @param documentId - Document identifier
   * @param status - New status
   * @param error - Optional error message
   */
  async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    error?: string
  ): Promise<void> {
    try {
      const client = this.getClient();

      const updateData: Record<string, unknown> = {
        status,
        completed_at: status === 'complete' || status === 'error' ? new Date().toISOString() : undefined,
      };

      if (error) {
        updateData.error_message = error;
      }

      await client
        .from('documents')
        .update(updateData)
        .eq('id', documentId);
    } catch (err) {
      console.error('Failed to update document status:', err);
    }
  }

  /**
   * Create a new document record in the database
   * @param file - Upload file information
   * @param extraction - PDF extraction result
   * @returns Promise resolving to document ID
   */
  async createDocumentRecord(
    file: UploadFile,
    extraction: TextExtractionResult
  ): Promise<string> {
    try {
      const client = this.getClient();

      const documentData = {
        id: crypto.randomUUID(),
        filename: file.name,
        file_size: file.size,
        page_count: extraction.pages,
        chunk_count: extraction.chunks,
        status: 'processing' as DocumentStatus,
        created_at: new Date().toISOString(),
        metadata: {
          title: extraction.metadata.title,
          author: extraction.metadata.author,
          creationDate: extraction.metadata.creationDate,
        },
      };

      const { data, error } = await client
        .from('documents')
        .insert(documentData)
        .select()
        .single();

      if (error) {
        console.error('Failed to create document record:', error);
        throw new Error('Failed to create document record');
      }

      return data.id;
    } catch (error) {
      console.error('Document creation error:', error);
      throw new Error('Unable to create document record');
    }
  }

  /**
   * Retrieve all chunks for a specific document
   * @param documentId - Document identifier
   * @returns Promise resolving to array of chunk records
   */
  async getDocumentChunks(documentId: string): Promise<ChunkRecord[]> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });

      if (error) {
        console.error('Failed to retrieve chunks:', error);
        throw new Error('Failed to retrieve document chunks');
      }

      return data.map(row => ({
        id: row.id,
        document_id: row.document_id,
        chunk_index: row.chunk_index,
        chunk_text: row.chunk_text,
        embedding: row.embedding,
        metadata: row.metadata,
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Chunk retrieval error:', error);
      return [];
    }
  }

  /**
   * Estimate token count for a text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if processing is already in progress for a session
   */
  async isProcessingInProgress(sessionId: string): Promise<boolean> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from('documents')
        .select('id')
        .eq('session_id', sessionId)
        .eq('status', 'processing')
        .limit(1);

      if (error) {
        console.error('Failed to check processing status:', error);
        return false;
      }

      return data.length > 0;
    } catch (error) {
      console.error('Status check error:', error);
      return false;
    }
  }

  /**
   * Get files pending processing for a session
   */
  async getPendingFiles(sessionId: string): Promise<string[]> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from('documents')
        .select('id')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to get pending files:', error);
        return [];
      }

      return data.map(doc => doc.id);
    } catch (error) {
      console.error('Pending files query error:', error);
      return [];
    }
  }
}

// Export singleton instance for easy use
export const vectorStorage = VectorStorage.getInstance();
