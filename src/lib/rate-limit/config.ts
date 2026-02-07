/**
 * Rate Limiting Configuration
 * 
 * Configures rate limiting behavior for the chat API.
 * Uses Upstash Redis for sliding window rate limiting.
 */

// Rate limit configuration
export const RATE_LIMIT_CONFIG = {
  // Maximum requests per time window
  MAX_REQUESTS: 50,
  // Time window in seconds (1 hour = 3600 seconds)
  WINDOW_SECONDS: 3600,
  // Prefix for rate limit keys in Redis
  KEY_PREFIX: 'ratelimit:chat:',
  // Whether rate limiting is enabled
  ENABLED: process.env.RATE_LIMIT_ENABLED !== 'false',
  // Custom message when rate limited
  MESSAGE: 'Rate limit exceeded. Please try again in {time}.',
} as const;

// Rate limit response headers
export const RATE_LIMIT_HEADERS = {
  REMAINING: 'x-ratelimit-remaining',
  LIMIT: 'x-ratelimit-limit',
  RESET: 'x-ratelimit-reset',
  RETRY_AFTER: 'retry-after',
} as const;

/**
 * Get the rate limit key for a user
 */
export function getRateLimitKey(userId: string): string {
  return `${RATE_LIMIT_CONFIG.KEY_PREFIX}${userId}`;
}

/**
 * Get Redis URL from environment
 */
export function getRedisUrl(): string {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    throw new Error('UPSTASH_REDIS_REST_URL environment variable is required');
  }
  return url;
}

/**
 * Get Redis token from environment
 */
export function getRedisToken(): string {
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!token) {
    throw new Error('UPSTASH_REDIS_REST_TOKEN environment variable is required');
  }
  return token;
}
