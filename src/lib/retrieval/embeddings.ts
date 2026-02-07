/**
 * Query embedding generation module
 * Uses OpenAI text-embedding-3-small via Vercel AI SDK
 */

import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { preprocessQuery, generateCacheKey } from './preprocessing';
import { getCachedEmbedding, setCachedEmbedding } from './cache';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 256;

/**
 * Generates 256-dimensional embedding for user query
 * Uses cache to avoid redundant OpenAI API calls
 * Target latency: <500ms P50 (cache hit: <5ms)
 * 
 * @param query - User query string to generate embedding for
 * @returns Promise resolving to 256-element number array representing the embedding
 * @throws Error if query is empty after preprocessing or embedding service fails
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const startTime = Date.now();
  const normalizedQuery = preprocessQuery(query);
  
  if (!normalizedQuery || normalizedQuery.length === 0) {
    throw new Error('Query cannot be empty after preprocessing');
  }
  
  // Check cache first
  const cacheKey = generateCacheKey(normalizedQuery, 0, 0);  // No filters for embedding
  const cached = await getCachedEmbedding(cacheKey);
  
  if (cached.hit && cached.data) {
    const latency = Date.now() - startTime;
    console.log(`[embeddings] Cache hit in ${latency}ms`);
    return cached.data;
  }
  
  // Cache miss - generate embedding
  try {
    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: normalizedQuery,
    });
    
    const latency = Date.now() - startTime;
    console.log(`[embeddings] Generated embedding in ${latency}ms`);
    
    // Validate embedding dimensions
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.warn(
        `[embeddings] Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
      );
    }
    
    // Store in cache
    await setCachedEmbedding(cacheKey, embedding);
    
    return embedding;
  } catch (error) {
    console.error('[embeddings] Failed to generate embedding:', error);
    
    if (error instanceof Error && error.name === 'OpenAIError') {
      throw new Error('Embedding service temporarily unavailable');
    }
    throw error;
  }
}

/**
 * Batch embedding generation for multiple queries
 * Useful for pre-warming cache or processing multiple queries
 */
export async function generateBatchEmbeddings(
  queries: string[]
): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();
  
  for (const query of queries) {
    try {
      const embedding = await generateQueryEmbedding(query);
      results.set(query, embedding);
    } catch (error) {
      console.warn(`[embeddings] Batch embedding failed for: ${query.substring(0, 50)}`);
    }
  }
  
  return results;
}
