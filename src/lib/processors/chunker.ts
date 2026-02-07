/**
 * Semantic Text Chunker
 * LangChain.js RecursiveCharacterTextSplitter-based chunking with 500-token chunks and 50-token overlap
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TextExtractionResult } from './pdf-parser';

/**
 * Chunking options interface
 */
export interface ChunkOptions {
  /** Number of tokens per chunk (default: 500) */
  chunkSize?: number;
  /** Number of tokens to overlap between chunks (default: 50) */
  chunkOverlap?: number;
  /** Custom separators to use for splitting */
  separators?: string[];
}

/**
 * Result interface for text chunking
 */
export interface ChunkResult {
  /** Array of text chunks */
  chunks: string[];
  /** Total number of chunks */
  chunkCount: number;
  /** Start positions for source citation */
  chunkIndices: number[];
  /** Chunking metadata */
  metadata: {
    /** Actual average chunk size */
    chunkSize: number;
    /** Overlap tokens used */
    overlap: number;
    /** Separators used for splitting */
    separators: string[];
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
 * Semantic Chunker using LangChain.js RecursiveCharacterTextSplitter
 * Creates coherent chunks that respect sentence and paragraph boundaries
 */
export class SemanticChunker {
  /** Default chunk size (500 tokens) */
  private readonly defaultChunkSize = 500;
  /** Default chunk overlap (50 tokens) */
  private readonly defaultChunkOverlap = 50;
  /** Default separators for semantic splitting */
  private readonly defaultSeparators = ['\n\n', '\n', '. ', '! ', '? ', ', ', ' '];

  /**
   * Create chunks from text content
   * @param text - Text content to chunk
   * @param options - Chunking options
   * @returns ChunkResult with chunks and metadata
   */
  chunkText(text: string, options?: ChunkOptions): ChunkResult {
    if (!text || text.trim().length === 0) {
      return this.createEmptyResult();
    }

    const chunkSize = options?.chunkSize || this.defaultChunkSize;
    const chunkOverlap = options?.chunkOverlap || this.defaultChunkOverlap;
    const separators = options?.separators || this.defaultSeparators;

    // Create text splitter with semantic separators
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
      separators: separators,
    });

    // Split text into chunks
    const chunks = splitter.splitText(text);

    // Calculate chunk indices for citation
    const chunkIndices = this.calculateChunkIndices(chunks, text);

    // Calculate actual average chunk size
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const avgChunkSize = chunks.length > 0 ? Math.round(totalChars / chunks.length) : 0;

    return {
      chunks,
      chunkCount: chunks.length,
      chunkIndices,
      metadata: {
        chunkSize: avgChunkSize,
        overlap: chunkOverlap,
        separators,
      },
    };
  }

  /**
   * Chunk a complete document extraction result
   * @param doc - TextExtractionResult from PDF extraction
   * @param options - Chunking options
   * @returns ChunkResult with chunks and metadata
   */
  chunkDocument(doc: TextExtractionResult, options?: ChunkOptions): ChunkResult {
    const result = this.chunkText(doc.text, options);

    // If document has no text, return empty result with document info
    if (doc.text.trim().length === 0) {
      return {
        ...result,
        chunks: [],
        chunkCount: 0,
        chunkIndices: [],
      };
    }

    return result;
  }

  /**
   * Estimate chunk count for progress reporting
   * @param textLength - Length of text in characters
   * @returns Estimated number of chunks
   */
  getChunkCount(textLength: number): number {
    if (textLength === 0) return 0;

    // Estimate based on average characters per token (~4 characters per token)
    const estimatedTokens = Math.ceil(textLength / 4);
    return Math.ceil(estimatedTokens / this.defaultChunkSize);
  }

  /**
   * Validate chunk quality
   * @param chunks - Array of chunks to validate
   * @returns ValidationResult
   */
  validateChunks(chunks: string[]): ValidationResult {
    if (!chunks || chunks.length === 0) {
      return { valid: false, error: 'No chunks generated' };
    }

    // Check for empty chunks
    const emptyChunks = chunks.filter(chunk => !chunk || chunk.trim().length === 0);
    if (emptyChunks.length > 0) {
      return { valid: false, error: `${emptyChunks.length} empty chunks found` };
    }

    // Check for extremely short chunks (less than 50 characters)
    const shortChunks = chunks.filter(chunk => chunk && chunk.length < 50);
    if (shortChunks.length > chunks.length * 0.1) {
      return { valid: false, error: 'Many unusually short chunks detected' };
    }

    // Check for duplicate chunks
    const uniqueChunks = new Set(chunks);
    if (uniqueChunks.size < chunks.length) {
      return { valid: false, error: 'Duplicate chunks detected' };
    }

    return { valid: true };
  }

  /**
   * Calculate start indices for each chunk in the original text
   */
  private calculateChunkIndices(chunks: string[], originalText: string): number[] {
    const indices: number[] = [];
    let searchStart = 0;

    for (const chunk of chunks) {
      const index = originalText.indexOf(chunk, searchStart);
      if (index !== -1) {
        indices.push(index);
        searchStart = index + 1; // Move past the found chunk
      } else {
        // If we can't find the exact chunk, estimate position
        indices.push(searchStart);
      }
    }

    return indices;
  }

  /**
   * Create empty result for invalid inputs
   */
  private createEmptyResult(): ChunkResult {
    return {
      chunks: [],
      chunkCount: 0,
      chunkIndices: [],
      metadata: {
        chunkSize: 0,
        overlap: this.defaultChunkOverlap,
        separators: this.defaultSeparators,
      },
    };
  }
}

// Export singleton instance for easy use
export const semanticChunker = new SemanticChunker();
