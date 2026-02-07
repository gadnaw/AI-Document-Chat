/**
 * Query preprocessing utilities
 * Normalizes user queries for consistent embedding generation and caching
 */

/**
 * Normalizes user query for consistent embedding generation
 * Ensures identical semantic queries produce identical embeddings
 * 
 * @param query - Raw user query string
 * @returns Normalized query string suitable for embedding generation
 */
export function preprocessQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/[^\w\s?.-]/g, '')    // Keep ?.- for questions
    .trim();
}

/**
 * Generates cache key for query caching layer
 * Includes query + filter parameters for cache isolation
 * 
 * @param query - User query string
 * @param topK - Number of results requested
 * @param threshold - Similarity threshold applied
 * @param documentIds - Optional document filter
 * @returns Cache key string for embedding caching
 */
export function generateCacheKey(
  query: string,
  topK: number,
  threshold: number,
  documentIds?: string[]
): string {
  const normalized = preprocessQuery(query);
  const docFilter = documentIds?.sort().join(',') || 'all';
  return `search:${normalized}:${topK}:${threshold}:${docFilter}`;
}
