import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import { getConfig, CACHE_CONFIG, isRedisConfigured } from './cache-config';
import { SearchResponse } from './search';

// Type definitions
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  hits: number;
};

// Lazy Redis initialization
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }
  
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    redisClient.on('error', (err) => {
      console.error('[cache] Redis connection error:', err);
      redisClient = null;  // Disable Redis on error
    });
  }
  
  return redisClient;
}

// Initialize in-memory LRU caches (always available as fallback)
const embeddingCache = new LRUCache<string, CacheEntry<number[]>>({
  max: CACHE_CONFIG.embeddingCache.maxEntries,
  ttl: CACHE_CONFIG.embeddingCache.ttlMs,
  allowStale: true,
});

const queryCache = new LRUCache<string, CacheEntry<SearchResponse>>({
  max: CACHE_CONFIG.queryCache.maxEntries,
  ttl: CACHE_CONFIG.queryCache.ttlMs,
  allowStale: true,
});

// Cache statistics
interface CacheStats {
  embedding: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  query: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  redis: {
    connected: boolean;
    ping: number | null;
  };
}

const embeddingStats = { hits: 0, misses: 0 };
const queryStats = { hits: 0, misses: 0 };

/**
 * Get or set embedding cache
 */
export async function getCachedEmbedding(
  key: string
): Promise<{ hit: boolean; data?: number[] }> {
  const config = getConfig();
  if (!config.embeddingCache.enabled) {
    return { hit: false };
  }
  
  // Check local cache first
  const local = embeddingCache.get(key);
  if (local && !isStale(local.timestamp)) {
    embeddingStats.hits++;
    console.log(`[cache] Embedding hit (local): ${key.substring(0, 50)}...`);
    return { hit: true, data: local.data };
  }
  
  // Check Redis if available
  const redis = getRedisClient();
  if (redis && config.performance.localFirst) {
    try {
      const cached = await redis.get(`emb:${key}`);
      if (cached) {
        embeddingStats.hits++;
        const parsed = JSON.parse(cached);
        // Store in local cache for next time
        embeddingCache.set(key, {
          data: parsed,
          timestamp: Date.now(),
          hits: 1,
        });
        console.log(`[cache] Embedding hit (Redis): ${key.substring(0, 50)}...`);
        return { hit: true, data: parsed };
      }
    } catch (err) {
      console.warn('[cache] Redis embedding read failed:', err);
    }
  }
  
  embeddingStats.misses++;
  return { hit: false };
}

export async function setCachedEmbedding(
  key: string,
  embedding: number[]
): Promise<void> {
  const config = getConfig();
  if (!config.embeddingCache.enabled) {
    return;
  }
  
  const entry: CacheEntry<number[]> = {
    data: embedding,
    timestamp: Date.now(),
    hits: 0,
  };
  
  // Store in local cache
  embeddingCache.set(key, entry);
  
  // Store in Redis if available
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(
        `emb:${key}`,
        Math.floor(config.embeddingCache.ttlMs / 1000),
        JSON.stringify(embedding)
      );
    } catch (err) {
      console.warn('[cache] Redis embedding write failed:', err);
    }
  }
}

/**
 * Get or set query result cache
 */
export async function getCachedResults(
  key: string
): Promise<{ hit: boolean; data?: SearchResponse }> {
  const config = getConfig();
  if (!config.queryCache.enabled) {
    return { hit: false };
  }
  
  // Check local cache first
  const local = queryCache.get(key);
  if (local && !isStale(local.timestamp)) {
    queryStats.hits++;
    local.hits++;  // Increment hit count
    console.log(`[cache] Query hit (local): ${key.substring(0, 50)}...`);
    return { hit: true, data: local.data };
  }
  
  // Check Redis if available
  const redis = getRedisClient();
  if (redis && config.performance.localFirst) {
    try {
      const cached = await redis.get(`query:${key}`);
      if (cached) {
        queryStats.hits++;
        const parsed = JSON.parse(cached);
        // Store in local cache
        queryCache.set(key, {
          data: parsed,
          timestamp: Date.now(),
          hits: 1,
        });
        console.log(`[cache] Query hit (Redis): ${key.substring(0, 50)}...`);
        return { hit: true, data: parsed };
      }
    } catch (err) {
      console.warn('[cache] Redis query read failed:', err);
    }
  }
  
  queryStats.misses++;
  return { hit: false };
}

export async function setCachedResults(
  key: string,
  results: SearchResponse
): Promise<void> {
  const config = getConfig();
  if (!config.queryCache.enabled) {
    return;
  }
  
  const entry: CacheEntry<SearchResponse> = {
    data: results,
    timestamp: Date.now(),
    hits: 0,
  };
  
  // Store in local cache
  queryCache.set(key, entry);
  
  // Store in Redis if available
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(
        `query:${key}`,
        Math.floor(config.queryCache.ttlMs / 1000),
        JSON.stringify(results)
      );
    } catch (err) {
      console.warn('[cache] Redis query write failed:', err);
    }
  }
}

/**
 * Invalidate cache for a specific user
 */
export async function invalidateUserCache(userId: string): Promise<number> {
  let invalidated = 0;
  const redis = getRedisClient();
  const config = getConfig();
  
  // Clear local caches (approximate - keys don't store user)
  // For full user invalidation, we'd need user-prefixed keys
  if (config.invalidation.onUserDelete) {
    embeddingCache.clear();
    queryCache.clear();
    invalidated += embeddingCache.size + queryCache.size;
  }
  
  // Clear Redis entries with user prefix
  if (redis && config.invalidation.onUserDelete) {
    try {
      const keys = await redis.keys(`*:${userId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        invalidated += keys.length;
      }
    } catch (err) {
      console.warn('[cache] Redis user invalidation failed:', err);
    }
  }
  
  console.log(`[cache] Invalidated ${invalidated} entries for user ${userId}`);
  return invalidated;
}

/**
 * Invalidate cache when document is updated
 */
export async function invalidateDocumentCache(documentId: string): Promise<void> {
  const redis = getRedisClient();
  
  // For document-specific invalidation, we'd need document-prefixed keys
  // This is a placeholder for the full implementation
  if (redis) {
    try {
      // Clear all query cache on document update (conservative approach)
      const keys = await redis.keys(`query:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.warn('[cache] Redis document invalidation failed:', err);
    }
  }
  
  // Clear local cache
  queryCache.clear();
  console.log(`[cache] Invalidated cache for document ${documentId}`);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): CacheStats {
  return {
    embedding: {
      size: embeddingCache.size,
      hits: embeddingStats.hits,
      misses: embeddingStats.misses,
      hitRate: embeddingStats.hits + embeddingStats.misses > 0
        ? embeddingStats.hits / (embeddingStats.hits + embeddingStats.misses)
        : 0,
    },
    query: {
      size: queryCache.size,
      hits: queryStats.hits,
      misses: queryStats.misses,
      hitRate: queryStats.hits + queryStats.misses > 0
        ? queryStats.hits / (queryStats.hits + queryStats.misses)
        : 0,
    },
    redis: {
      connected: !!redisClient,
      ping: redisClient ? 0 : null, // Will be async in real implementation
    },
  };
}

/**
 * Helper: Check if cache entry is stale
 */
function isStale(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_CONFIG.embeddingCache.ttlMs;
}

// Export cache instances and utilities
export { embeddingCache, queryCache };
