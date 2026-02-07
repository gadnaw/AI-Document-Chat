/**
 * Core retrieval module
 * Provides semantic search functionality for RAG context
 */

import { createClient } from '@supabase/supabase-js';
import { generateQueryEmbedding } from './embeddings';
import { preprocessQuery, generateCacheKey } from './preprocessing';
import { SearchResult, RetrievalOptions } from './types';
import {
  getCachedResults,
  setCachedResults,
  getCacheStats,
  invalidateDocumentCache,
} from './cache';

// Initialize Supabase client with service role for RPC calls
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_TOP_K = 5;
const DEFAULT_THRESHOLD = 0.7;

/**
 * Search response interface containing results and metadata
 */
interface SearchResponse {
  results: SearchResult[];
  metadata: {
    query: string;
    totalResults: number;
    latencyMs: number;
    cached: boolean;
  };
}

/**
 * Core retrieval function with caching
 * Returns relevant document chunks with citation metadata
 * Target total latency: <2 seconds P95 (cache hit: <50ms)
 * 
 * @param query - User query string to search for
 * @param options - Optional retrieval configuration (topK, threshold, userId, documentIds)
 * @returns Promise resolving to SearchResponse with results and metadata
 * @throws Error if userId is missing or parameters are invalid
 */
export async function retrieveRelevantChunks(
  query: string,
  options?: RetrievalOptions
): Promise<SearchResponse> {
  const startTime = Date.now();
  
  const {
    topK = DEFAULT_TOP_K,
    threshold = DEFAULT_THRESHOLD,
    userId,
    documentIds,
  } = options || {};
  
  if (!userId) {
    throw new Error('userId is required for RLS enforcement');
  }
  
  // Validate parameters
  if (topK < 1 || topK > 20) {
    throw new Error('topK must be between 1 and 20');
  }
  if (threshold < 0 || threshold > 1) {
    throw new Error('threshold must be between 0 and 1');
  }
  
  // Generate cache key
  const normalizedQuery = preprocessQuery(query);
  const cacheKey = generateCacheKey(normalizedQuery, topK, threshold, documentIds);
  
  // Check cache first
  const cached = await getCachedResults(cacheKey);
  if (cached.hit && cached.data) {
    const latency = Date.now() - startTime;
    console.log(`[search] Cache hit in ${latency}ms`);
    return {
      ...cached.data,
      metadata: {
        ...cached.data.metadata,
        latencyMs: latency,
        cached: true,
      },
    };
  }
  
  // Cache miss - generate embedding
  const embedding = await generateQueryEmbedding(normalizedQuery);
  
  // Execute vector similarity search
  const { data: chunks, error } = await supabase.rpc('search_chunks', {
    p_query_embedding: embedding,
    p_user_id: userId,
    p_document_ids: documentIds || null,
    p_threshold: threshold,
    p_limit: topK * 2,
  });
  
  if (error) {
    console.error('[search] Vector search failed:', error);
    throw new Error('Search service temporarily unavailable');
  }
  
  // Transform and filter results
  const results: SearchResult[] = chunks
    .map((chunk: any) => ({
      id: chunk.id,
      documentId: chunk.document_id,
      documentName: chunk.document_name,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      similarityScore: 1 - chunk.similarity,
      pageNumber: chunk.page_number,
      metadata: chunk.metadata,
    }))
    .filter((result: SearchResult) => result.similarityScore >= threshold)
    .slice(0, topK);
  
  const latency = Date.now() - startTime;
  console.log(`[search] Retrieved ${results.length} chunks in ${latency}ms`);
  
  const response: SearchResponse = {
    results,
    metadata: {
      query,
      totalResults: results.length,
      latencyMs: latency,
      cached: false,
    },
  };
  
  // Store in cache
  await setCachedResults(cacheKey, response);
  
  return response;
}

/**
 * Invalidate cache when document is updated
 * Call this from document processing when chunks change
 */
export async function onDocumentUpdated(documentId: string): Promise<void> {
  await invalidateDocumentCache(documentId);
  console.log(`[search] Cache invalidated for document ${documentId}`);
}

/**
 * Get cache statistics (for monitoring endpoint)
 */
export { getCacheStats };
