/**
 * Cache configuration for retrieval infrastructure
 * Centralized settings for TTL, limits, and invalidation policies
 */

export interface CacheConfig {
  // Embedding cache settings
  embeddingCache: {
    enabled: boolean;
    ttlMs: number;           // 5 minutes default
    maxEntries: number;       // Maximum cached embeddings
  };
  
  // Query result cache settings
  queryCache: {
    enabled: boolean;
    ttlMs: number;            // 5 minutes default
    maxEntries: number;       // Maximum cached queries
  };
  
  // Invalidation settings
  invalidation: {
    onDocumentUpdate: boolean; // Invalidate when doc changes
    onUserDelete: boolean;     // Invalidate all user cache on delete
    staggerInvalidation: boolean; // Stagger invalidation to prevent stampede
  };
  
  // Performance settings
  performance: {
    redisTimeoutMs: number;   // Redis connection timeout
    localFirst: boolean;      // Check local cache before Redis
    warmupOnStart: boolean;   // Pre-populate cache on startup
  };
}

// Default configuration
export const CACHE_CONFIG: CacheConfig = {
  embeddingCache: {
    enabled: true,
    ttlMs: 5 * 60 * 1000,     // 5 minutes
    maxEntries: 1000,         // Support many unique queries
  },
  queryCache: {
    enabled: true,
    ttlMs: 5 * 60 * 1000,      // 5 minutes
    maxEntries: 500,          // Balance memory vs hit rate
  },
  invalidation: {
    onDocumentUpdate: true,   // Invalidate when documents change
    onUserDelete: true,        // Clear user cache on account deletion
    staggerInvalidation: true, // Prevent cache stampede
  },
  performance: {
    redisTimeoutMs: 5000,      // 5 second timeout for Redis
    localFirst: true,          // Check memory before Redis
    warmupOnStart: false,      // Don't warmup by default
  },
};

/**
 * Get cache configuration (with environment overrides)
 */
export function getConfig(): CacheConfig {
  return {
    embeddingCache: {
      enabled: process.env.EMBEDDING_CACHE_ENABLED !== 'false',
      ttlMs: parseInt(process.env.EMBEDDING_CACHE_TTL_MS || '300000', 10),
      maxEntries: parseInt(process.env.EMBEDDING_CACHE_MAX_ENTRIES || '1000', 10),
    },
    queryCache: {
      enabled: process.env.QUERY_CACHE_ENABLED !== 'false',
      ttlMs: parseInt(process.env.QUERY_CACHE_TTL_MS || '300000', 10),
      maxEntries: parseInt(process.env.QUERY_CACHE_MAX_ENTRIES || '500', 10),
    },
    invalidation: {
      onDocumentUpdate: process.env.CACHE_INVALIDATE_ON_UPDATE !== 'false',
      onUserDelete: process.env.CACHE_INVALIDATE_ON_DELETE !== 'false',
      staggerInvalidation: process.env.CACHE_STAGGER_INVALIDATION !== 'false',
    },
    performance: {
      redisTimeoutMs: parseInt(process.env.REDIS_TIMEOUT_MS || '5000', 10),
      localFirst: process.env.CACHE_LOCAL_FIRST !== 'false',
      warmupOnStart: process.env.CACHE_WARMUP_ON_START === 'true',
    },
  };
}

/**
 * Environment check for Redis availability
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.REDIS_URL ||
    process.env.UPSTASH_REDIS_REST_URL
  );
}
