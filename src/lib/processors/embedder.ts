/**
 * Embedding Generation Processor
 * OpenAI text-embedding-3-small with batch processing and rate limiting
 */

import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * Embedding options interface
 */
export interface EmbedOptions {
  /** Dimensions for the embedding (default: 1536) */
  dimensions?: number;
  /** Batch size for processing (default: 100) */
  batchSize?: number;
  /** Maximum retries on rate limit errors (default: 3) */
  maxRetries?: number;
}

/**
 * Result interface for embedding generation
 */
export interface EmbeddingResult {
  /** Array of 1536-dimensional embedding vectors */
  embeddings: number[][];
  /** Total API tokens consumed */
  tokensUsed: number;
  /** Model used for embedding */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Number of API calls made */
  batchCount: number;
}

/**
 * Single text embedding result
 */
export interface SingleEmbeddingResult {
  /** Original text */
  text: string;
  /** Embedding vector */
  embedding: number[];
  /** Model used */
  model: string;
}

/**
 * Embedding validation result
 */
export interface EmbeddingValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Rate limit handling configuration
 */
interface RateLimitConfig {
  /** Requests per minute limit */
  rpm: number;
  /** Tokens per minute limit */
  tpm: number;
  /** Base delay for exponential backoff (ms) */
  baseDelay: number;
}

/**
 * Embedding Generator using OpenAI text-embedding-3-small
 * Handles batch processing, rate limiting, and validation
 */
export class EmbeddingGenerator {
  /** OpenAI API client */
  private client: OpenAIEmbeddings | null = null;
  /** Singleton instance */
  private static instance: EmbeddingGenerator;

  /** Rate limit configuration for text-embedding-3-small */
  private readonly rateLimitConfig: RateLimitConfig = {
    rpm: 3000, // Requests per minute
    tpm: 1000000, // Tokens per minute (very high limit)
    baseDelay: 1000, // Base delay for backoff
  };

  /** Default embedding dimensions */
  private readonly defaultDimensions = 1536;

  /**
   * Get singleton instance
   */
  static getInstance(): EmbeddingGenerator {
    if (!EmbeddingGenerator.instance) {
      EmbeddingGenerator.instance = new EmbeddingGenerator();
    }
    return EmbeddingGenerator.instance;
  }

  /**
   * Initialize or get the OpenAI embeddings client
   */
  private getClient(): OpenAIEmbeddings {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
        throw new Error('OPENAI_API_KEY environment variable is not configured');
      }

      this.client = new OpenAIEmbeddings({
        apiKey,
        model: 'text-embedding-3-small',
        dimensions: this.defaultDimensions,
      });
    }

    return this.client;
  }

  /**
   * Generate embeddings for multiple text chunks
   * @param chunks - Array of text chunks to embed
   * @param options - Embedding options
   * @returns Promise resolving to EmbeddingResult
   */
  async generateEmbeddings(chunks: string[], options?: EmbedOptions): Promise<EmbeddingResult> {
    if (!chunks || chunks.length === 0) {
      return this.createEmptyResult();
    }

    const batchSize = options?.batchSize || 100;
    const maxRetries = options?.maxRetries || 3;
    const dimensions = options?.dimensions || this.defaultDimensions;

    const embeddings: number[][] = [];
    let totalTokensUsed = 0;
    let batchCount = 0;

    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      let retryCount = 0;
      let success = false;

      // Retry logic for rate limiting
      while (!success && retryCount <= maxRetries) {
        try {
          const startTime = Date.now();

          // Generate embeddings for the batch
          const batchEmbeddings = await this.getClient().embedDocuments(batch);

          // Track tokens used (estimate)
          const batchTokens = batch.reduce((sum, text) => sum + this.estimateTokens(text), 0);
          totalTokensUsed += batchTokens;

          embeddings.push(...batchEmbeddings);
          batchCount++;
          success = true;

          // Log generation time for monitoring
          const duration = Date.now() - startTime;
          console.log(`Batch ${batchCount}: ${batch.length} chunks, ${batchTokens} tokens, ${duration}ms`);

        } catch (error) {
          if (this.isRateLimitError(error) && retryCount < maxRetries) {
            // Exponential backoff
            const delay = this.calculateBackoffDelay(retryCount);
            console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
            await this.sleep(delay);
            retryCount++;
          } else {
            // Re-throw other errors
            throw error;
          }
        }
      }

      if (!success) {
        throw new Error(`Failed to process batch after ${maxRetries} retries`);
      }
    }

    return {
      embeddings,
      tokensUsed: totalTokensUsed,
      model: 'text-embedding-3-small',
      dimensions,
      batchCount,
    };
  }

  /**
   * Generate embedding for a single text
   * @param text - Text to embed
   * @returns Promise resolving to SingleEmbeddingResult
   */
  async embedText(text: string): Promise<SingleEmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    const client = this.getClient();
    const [embedding] = await client.embedDocuments([text]);

    return {
      text,
      embedding,
      model: 'text-embedding-3-small',
    };
  }

  /**
   * Batch embed with custom batch size
   * @param chunks - Array of text chunks
   * @param batchSize - Number of chunks per batch
   * @returns Promise resolving to EmbeddingResult
   */
  async batchEmbed(chunks: string[], batchSize?: number): Promise<EmbeddingResult> {
    return this.generateEmbeddings(chunks, { batchSize });
  }

  /**
   * Validate embedding vector
   * @param embedding - Embedding vector to validate
   * @returns EmbeddingValidationResult
   */
  validateEmbedding(embedding: number[]): EmbeddingValidationResult {
    if (!embedding || embedding.length === 0) {
      return { valid: false, error: 'Empty embedding vector' };
    }

    // Check dimensions (should be 1536 for text-embedding-3-small)
    if (embedding.length !== this.defaultDimensions) {
      return {
        valid: false,
        error: `Invalid embedding dimensions: expected ${this.defaultDimensions}, got ${embedding.length}`,
      };
    }

    // Check for NaN or Infinity values
    const hasNaN = embedding.some(value => isNaN(value));
    const hasInfinity = embedding.some(value => !isFinite(value));

    if (hasNaN || hasInfinity) {
      return { valid: false, error: 'Embedding contains invalid values (NaN or Infinity)' };
    }

    // Check vector magnitude (should be approximately 1.0 for normalized vectors)
    const magnitude = this.calculateMagnitude(embedding);
    if (magnitude < 0.1 || magnitude > 2.0) {
      console.warn(`Unusual embedding magnitude: ${magnitude} (expected ~1.0)`);
    }

    return { valid: true };
  }

  /**
   * Estimate token count for a text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate magnitude of a vector
   */
  private calculateMagnitude(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('429') ||
      errorMessage.toLowerCase().includes('rate limit') ||
      errorMessage.toLowerCase().includes('too many requests')
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    return this.rateLimitConfig.baseDelay * Math.pow(2, retryCount);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create empty result for invalid inputs
   */
  private createEmptyResult(): EmbeddingResult {
    return {
      embeddings: [],
      tokensUsed: 0,
      model: 'text-embedding-3-small',
      dimensions: this.defaultDimensions,
      batchCount: 0,
    };
  }
}

// Export singleton instance for easy use
export const embeddingGenerator = EmbeddingGenerator.getInstance();
