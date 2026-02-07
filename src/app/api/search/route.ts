/**
 * @api {post} /api/search Semantic Document Search
 * @apiDescription Performs semantic search across user's documents using vector embeddings
 * @apiVersion 1.0.0
 * 
 * @apiParam {string} query - The search query (1-1000 characters)
 * @apiParam {number} [topK=5] - Number of results to return (1-20)
 * @apiParam {number} [threshold=0.7] - Minimum similarity score (0-1)
 * @apiParam {string[]} [documentIds] - Optional filter to specific documents
 * 
 * @apiSuccess {boolean} success - Always true for successful responses
 * @apiSuccess {object} data - Response payload
 * @apiSuccess {array} data.results - Array of matching chunks
 * @apiSuccess {object} data.metadata - Query metadata
 * 
 * @apiExample {json} Request Example:
 *   {
 *     "query": "What are the main findings in the quarterly report?",
 *     "topK": 10,
 *     "threshold": 0.6
 *   }
 * 
 * @apiExample {json} Response Example:
 *   {
 *     "success": true,
 *     "data": {
 *       "results": [...],
 *       "metadata": {
 *         "query": "What are the main findings...",
 *         "totalResults": 5,
 *         "latencyMs": 342,
 *         "cached": false
 *       }
 *     }
 *   }
 * 
 * @apiError (400) validation_error - Invalid request parameters
 * @apiError (401) unauthorized - Authentication required
 * @apiError (500) search_failed - Search service error
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { retrieveRelevantChunks, getCacheStats } from '@/lib/retrieval/search';
import {
  validateSearchRequest,
  getUserFromAuth,
  toRetrievalOptions,
} from '@/lib/retrieval/middleware';
import {
  errorResponse,
  successResponse,
  createError,
  classifyError,
  RetrievalError,
} from '@/lib/retrieval/errors';

// Simple in-memory rate limiter (use Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;  // requests per window
const RATE_WINDOW = 60 * 1000;  // 1 minute in milliseconds

/**
 * Simple rate limiter based on user ID or IP
 */
async function checkRateLimit(request: NextRequest): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const supabase = await createServerClient(false);
  
  // Get user ID or fall back to IP
  const { data: { user } } = await supabase.auth.getUser();
  const key = user?.id ?? request.ip ?? 'anonymous';
  
  const now = Date.now();
  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + RATE_WINDOW,
    });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: now + RATE_WINDOW };
  }
  
  if (current.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  
  current.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT - current.count,
    resetAt: current.resetAt,
  };
}

/**
 * POST /api/search
 * 
 * Performs semantic document search using vector embeddings
 * 
 * Request body:
 * {
 *   query: string (required)
 *   topK?: number (optional, default 5)
 *   threshold?: number (optional, default 0.7)
 *   documentIds?: string[] (optional, filter to specific documents)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   data?: {
 *     results: SearchResult[]
 *     metadata: {
 *       query: string
 *       totalResults: number
 *       latencyMs: number
 *       cached: boolean
 *     }
 *   }
 *   error?: RetrievalError
 *   metadata?: { timestamp, requestId }
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = nanoid();
  const startTime = Date.now();
  
  try {
    // Check rate limit
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        errorResponse(
          createError('rate_limited', 'Rate limit exceeded', { retryAfter: 60 }),
          requestId
        ),
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    
    // Validate authentication
    const authResult = await getUserFromAuth();
    if (!authResult.success) {
      return NextResponse.json(
        errorResponse(authResult.error!, requestId),
        { status: 401 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = validateSearchRequest(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        errorResponse(validationResult.error!, requestId),
        { status: 400 }
      );
    }
    
    const validatedRequest = validationResult.data!;
    
    // Execute semantic search
    const searchResult = await retrieveRelevantChunks(
      validatedRequest.query,
      toRetrievalOptions(validatedRequest, authResult.userId!)
    );
    
    const totalLatency = Date.now() - startTime;
    
    console.log(`[api/search] Completed in ${totalLatency}ms, found ${searchResult.results.length} results`);
    
    const cacheStats = getCacheStats();
    
    const response = NextResponse.json(
      successResponse(
        {
          results: searchResult.results,
          metadata: {
            ...searchResult.metadata,
            totalLatencyMs: totalLatency,
            cacheStats: {
              embeddingHitRate: cacheStats.embedding.hitRate,
              queryHitRate: cacheStats.query.hitRate,
              cacheSize: cacheStats.query.size,
            },
          },
        },
        requestId
      ),
      { status: 200 }
    );
    
    // Add cache control headers for client-side caching (optional)
    response.headers.set('X-Cache', searchResult.metadata.cached ? 'HIT' : 'MISS');
    response.headers.set('X-Cache-Latency', `${searchResult.metadata.latencyMs}ms`);
    
    return response;
    
  } catch (error) {
    const classifiedError = classifyError(error);
    console.error(`[api/search] Error (request ${requestId}):`, classifiedError);
    
    // Log additional context for debugging
    if (!classifiedError.recoverable) {
      return NextResponse.json(
        errorResponse(classifiedError, requestId),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      errorResponse(classifiedError, requestId),
      { status: 500 }
    );
  }
}

/**
 * GET /api/search
 * 
 * Health check endpoint for the search service
 * Returns service status without authentication
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'search',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/search/stats
 * 
 * Returns cache performance statistics
 */
export async function GET_stats(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const detailed = searchParams.get('detailed') === 'true';
  
  const stats = getCacheStats();
  
  return NextResponse.json({
    service: 'search',
    timestamp: new Date().toISOString(),
    cache: {
      embedding: {
        enabled: true,
        size: stats.embedding.size,
        hits: stats.embedding.hits,
        misses: stats.embedding.misses,
        hitRate: `${(stats.embedding.hitRate * 100).toFixed(1)}%`,
      },
      query: {
        enabled: true,
        size: stats.query.size,
        hits: stats.query.hits,
        misses: stats.query.misses,
        hitRate: `${(stats.query.hitRate * 100).toFixed(1)}%`,
      },
      redis: {
        connected: stats.redis.connected,
        ping: stats.redis.ping,
      },
    },
  });
}
