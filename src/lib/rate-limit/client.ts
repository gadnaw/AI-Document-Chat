import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  RATE_LIMIT_CONFIG,
  RATE_LIMIT_HEADERS,
  getRateLimitKey,
  getRedisUrl,
  getRedisToken,
} from './config';

/**
 * Create Redis client for Upstash
 */
export function createRedisClient(): Redis {
  return new Redis({
    url: getRedisUrl(),
    token: getRedisToken(),
  });
}

/**
 * Create rate limiter with sliding window algorithm The sliding window algorithm
 * 
 * provides smoother rate limiting
 * compared to fixed windows by considering the last window's
 * remaining requests.
 */
export function createRateLimiter(redis: Redis): Ratelimit {
  return new Ratelimit({
    redis,
    // Use sliding window algorithm
    limiter: Ratelimit.slidingWindow(
      RATE_LIMIT_CONFIG.MAX_REQUESTS,
      `${RATE_LIMIT_CONFIG.WINDOW_SECONDS} s`
    ),
    // Analytics endpoint for monitoring (optional)
    analytics: true,
    // Prefix for rate limit keys
    prefix: RATE_LIMIT_CONFIG.KEY_PREFIX,
  });
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Check rate limit for a user
 */
export async function checkRateLimit(
  rateLimiter: Ratelimit,
  userId: string
): Promise<RateLimitResult> {
  const key = getRateLimitKey(userId);
  const result = await rateLimiter.limit(key);

  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: RATE_LIMIT_CONFIG.MAX_REQUESTS,
  };
}

/**
 * Create rate limit headers from result
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  
  headers.set(RATE_LIMIT_HEADERS.REMAINING, String(result.remaining));
  headers.set(RATE_LIMIT_HEADERS.LIMIT, String(result.limit));
  headers.set(RATE_LIMIT_HEADERS.RESET, String(Math.ceil(result.reset)));
  
  if (!result.allowed) {
    const retryAfter = Math.ceil(result.reset - Date.now() / 1000);
    headers.set(RATE_LIMIT_HEADERS.RETRY_AFTER, String(retryAfter));
  }

  return headers;
}

/**
 * Get rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil(result.reset - Date.now() / 1000);
  const minutes = Math.ceil(retryAfter / 60);
  
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: RATE_LIMIT_CONFIG.MESSAGE.replace('{time}', `${minutes} minutes`),
      retryAfter: retryAfter,
      remaining: result.remaining,
      limit: result.limit,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...createRateLimitHeaders(result),
      },
    }
  );
}

// Singleton rate limiter instance
let rateLimiterInstance: Ratelimit | null = null;
let redisClientInstance: Redis | null = null;

/**
 * Get or create the rate limiter singleton
 */
export function getRateLimiter(): Ratelimit {
  if (!rateLimiterInstance) {
    if (!RATE_LIMIT_CONFIG.ENABLED) {
      // Return a no-op rate limiter when disabled
      return createNoOpRateLimiter();
    }

    const redis = createRedisClient();
    redisClientInstance = redis;
    rateLimiterInstance = createRateLimiter(redis);
  }
  return rateLimiterInstance;
}

/**
 * Create a no-op rate limiter that always allows requests
 * Used when rate limiting is disabled
 */
function createNoOpRateLimiter(): Ratelimit {
  return {
    limit: async () => ({
      success: true,
      remaining: 9999,
      reset: Date.now() / 1000 + 3600,
    }),
  } as unknown as Ratelimit;
}

/**
 * Clean up rate limiter resources
 */
export async function cleanupRateLimiter(): Promise<void> {
  if (redisClientInstance) {
    await redisClientInstance.quit();
    redisClientInstance = null;
    rateLimiterInstance = null;
  }
}
