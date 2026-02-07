/**
 * @api {post} /api/retrieve Retrieve Chunks for RAG
 * @apiDescription Retrieves relevant document chunks with full citation metadata for RAG contexts
 * @apiVersion 1.0.0
 * 
 * @apiParam {string} query - The retrieval query
 * @apiParam {number} [topK=5] - Number of chunks to retrieve
 * @apiParam {number} [threshold=0.7] - Minimum similarity threshold
 * 
 * @apiSuccess {boolean} success - Always true
 * @apiSuccess {object} data - Retrieved chunks with citations
 * @apiSuccess {array} data.chunks - Chunks ready for LLM context
 * @apiSuccess {object} data.chunks[].citation - Source attribution
 * 
 * @apiNote Designed for AI/RAG integration where proper citation is critical
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createServerClient } from '@/lib/supabase/server';
import { retrieveRelevantChunks, getCacheStats } from '@/lib/retrieval/search';
import {
  validateRetrieveRequest,
  getUserFromAuth,
  toRetrievalOptions,
} from '@/lib/retrieval/middleware';
import {
  errorResponse,
  successResponse,
  createError,
  classifyError,
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
 * POST /api/retrieve
 * 
 * Retrieves document chunks optimized for RAG context
 * Similar to /api/search but focused on returning complete chunks
 * with full citation metadata for AI consumption
 * 
 * Request body:
 * {
 *   query: string (required)
 *   topK?: number (optional, default 5)
 *   threshold?: number (optional, default 0.7)
 *   documentIds?: string[] (optional)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   data?: {
 *     chunks: Array<{
 *       content: string
 *       citation: {
 *         documentId: string
 *         documentName: string
 *         chunkIndex: number
 *         pageNumber?: number
 *       }
 *       score: number
 *     }>
 *     metadata: { ... }
 *   }
 *   ...
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
    const validationResult = validateRetrieveRequest(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        errorResponse(validationResult.error!, requestId),
        { status: 400 }
      );
    }
    
    const validatedRequest = validationResult.data!;
    
    // Execute retrieval (same underlying function as search)
    const searchResult = await retrieveRelevantChunks(
      validatedRequest.query,
      toRetrievalOptions(validatedRequest, authResult.userId!)
    );
    
    // Transform results for RAG consumption
    const chunks = searchResult.results.map((result) => ({
      content: result.content,
      citation: {
        documentId: result.documentId,
        documentName: result.documentName,
        chunkIndex: result.chunkIndex,
        pageNumber: result.pageNumber,
      },
      score: result.similarityScore,
      metadata: result.metadata,
    }));
    
    const totalLatency = Date.now() - startTime;
    
    console.log(`[api/retrieve] Completed in ${totalLatency}ms, retrieved ${chunks.length} chunks`);
    
    const cacheStats = getCacheStats();
    
    const response = NextResponse.json(
      successResponse(
        {
          chunks,
          metadata: {
            query: searchResult.metadata.query,
            totalChunks: chunks.length,
            latencyMs: totalLatency,
            cached: searchResult.metadata.cached,
            cacheStats: {
              embeddingHitRate: cacheStats.embedding.hitRate,
              queryHitRate: cacheStats.query.hitRate,
            },
          },
        },
        requestId
      ),
      { status: 200 }
    );
    
    response.headers.set('X-Cache', searchResult.metadata.cached ? 'HIT' : 'MISS');
    response.headers.set('X-Cache-Latency', `${searchResult.metadata.latencyMs}ms`);
    
    return response;
    
  } catch (error) {
    const classifiedError = classifyError(error);
    console.error(`[api/retrieve] Error (request ${requestId}):`, classifiedError);
    
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
 * GET /api/retrieve
 * 
 * Health check endpoint for the retrieve service
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'retrieve',
    timestamp: new Date().toISOString(),
  });
}
