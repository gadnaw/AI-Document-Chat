import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * Unit Tests: Rate Limiter (src/lib/rate-limit/client.ts)
 * Tests rate limiting functionality
 */
describe('RateLimiter', () => {
  
  beforeEach(() => {
    vi.resetModules();
  });
  
  afterEach(async () => {
    // Clean up any rate limiter instances
    try {
      const { cleanupRateLimiter } = await import('@/lib/rate-limit/client');
      await cleanupRateLimiter();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Rate Limit Result', () => {
    it('should create rate limit result structure', async () => {
      const { RateLimitResult } = await import('@/lib/rate-limit/client');
      
      const result: RateLimitResult = {
        allowed: true,
        remaining: 49,
        reset: Date.now() / 1000 + 3600,
        limit: 50,
      };
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49);
      expect(result.limit).toBe(50);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should create headers for allowed request', async () => {
      const { createRateLimitHeaders } = await import('@/lib/rate-limit/client');
      
      const result: RateLimitResult = {
        allowed: true,
        remaining: 45,
        reset: Date.now() / 1000 + 3600,
        limit: 50,
      };
      
      const headers = createRateLimitHeaders(result);
      
      expect(headers.get('x-ratelimit_remaining')).toBe('45');
      expect(headers.get('x-ratelimit_limit')).toBe('50');
      expect(headers.has('retry-after')).toBe(false);
    });

    it('should create headers with retry-after for denied request', async () => {
      const { createRateLimitHeaders } = await import('@/lib/rate-limit/client');
      
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        reset: Date.now() / 1000 + 300,
        limit: 50,
      };
      
      const headers = createRateLimitHeaders(result);
      
      expect(headers.get('x-ratelimit_remaining')).toBe('0');
      expect(headers.get('x-ratelimit_limit')).toBe('50');
      expect(headers.has('retry-after')).toBe(true);
    });
  });

  describe('Rate Limit Response', () => {
    it('should create error response for rate limited request', async () => {
      const { createRateLimitResponse } = await import('@/lib/rate-limit/client');
      
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        reset: Date.now() / 1000 + 300,
        limit: 50,
      };
      
      const response = createRateLimitResponse(result);
      
      expect(response.status).toBe(429);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      expect(body.error).toBe('Rate limit exceeded');
      expect(body.retryAfter).toBeGreaterThan(0);
    });

    it('should include helpful message in response', async () => {
      const { createRateLimitResponse } = await import('@/lib/rate-limit/client');
      
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        reset: Date.now() / 1000 + 600,
        limit: 50,
      };
      
      const response = createRateLimitResponse(result);
      const body = await response.json();
      
      expect(body.message).toContain('minutes');
      expect(body.limit).toBe(50);
    });
  });

  describe('Rate Limiter Configuration', () => {
    it('should export rate limit config', async () => {
      const { RATE_LIMIT_CONFIG } = await import('@/lib/rate-limit/config');
      
      expect(RATE_LIMIT_CONFIG).toHaveProperty('MAX_REQUESTS');
      expect(RATE_LIMIT_CONFIG).toHaveProperty('WINDOW_SECONDS');
      expect(RATE_LIMIT_CONFIG).toHaveProperty('KEY_PREFIX');
      expect(RATE_LIMIT_CONFIG).toHaveProperty('ENABLED');
    });

    it('should export rate limit headers', async () => {
      const { RATE_LIMIT_HEADERS } = await import('@/lib/rate-limit/config');
      
      expect(RATE_LIMIT_HEADERS).toHaveProperty('LIMIT');
      expect(RATE_LIMIT_HEADERS).toHaveProperty('REMAINING');
      expect(RATE_LIMIT_HEADERS).toHaveProperty('RESET');
      expect(RATE_LIMIT_HEADERS).toHaveProperty('RETRY_AFTER');
    });
  });

  describe('No-Op Rate Limiter', () => {
    it('should always allow requests when disabled', async () => {
      // Mock disabled config
      vi.doMock('@/lib/rate-limit/config', () => ({
        RATE_LIMIT_CONFIG: {
          MAX_REQUESTS: 50,
          WINDOW_SECONDS: 3600,
          KEY_PREFIX: 'ratelimit',
          ENABLED: false,
          MESSAGE: 'Rate limit exceeded. Please try again in {time}.',
        },
        RATE_LIMIT_HEADERS: {
          LIMIT: 'x-ratelimit-limit',
          REMAINING: 'x-ratelimit_remaining',
          RESET: 'x-ratelimit-reset',
          RETRY_AFTER: 'retry-after',
        },
        getRateLimitKey: (userId: string) => `disabled:${userId}`,
        getRedisUrl: () => 'http://localhost:6379',
        getRedisToken: () => 'test-token',
      }));
      
      const { getRateLimiter } = await import('@/lib/rate-limit/client');
      const limiter = getRateLimiter();
      
      const result = await limiter.limit('test-user');
      
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9999);
    });
  });

  describe('Rate Limit Key Generation', () => {
    it('should generate rate limit key from user ID', async () => {
      const { getRateLimitKey } = await import('@/lib/rate-limit/config');
      
      const key = getRateLimitKey('user-123');
      
      expect(key).toContain('user-123');
      expect(key).toContain('ratelimit');
    });
  });

  describe('Redis Client', () => {
    it('should create Redis client with config', async () => {
      const { createRedisClient } = await import('@/lib/rate-limit/client');
      
      // Should not throw (may fail to connect in test env)
      const client = createRedisClient();
      
      expect(client).toBeDefined();
    });
  });

  describe('Rate Limit Check', () => {
    it('should check rate limit for user', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit/client');
      
      // Create mock rate limiter
      const mockLimiter = {
        limit: vi.fn().mockResolvedValue({
          success: true,
          remaining: 49,
          reset: Date.now() / 1000 + 3600,
        }),
      };
      
      const result = await checkRateLimit(mockLimiter as any, 'test-user');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49);
    });

    it('should handle rate limit exceeded', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit/client');
      
      const mockLimiter = {
        limit: vi.fn().mockResolvedValue({
          success: false,
          remaining: 0,
          reset: Date.now() / 1000 + 300,
        }),
      };
      
      const result = await checkRateLimit(mockLimiter as any, 'test-user');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });
});
