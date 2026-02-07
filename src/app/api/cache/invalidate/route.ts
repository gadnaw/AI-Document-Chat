import { NextRequest, NextResponse } from 'next/server';
import { getUserFromAuth } from '@/lib/retrieval/middleware';
import { invalidateUserCache, invalidateDocumentCache, getCacheStats } from '@/lib/retrieval/cache';
import { createError, errorResponse, successResponse } from '@/lib/retrieval/errors';
import { nanoid } from 'nanoid';

/**
 * POST /api/cache/invalidate
 * 
 * Programmatic cache invalidation endpoint
 * Used when documents are updated/deleted
 * 
 * Request body:
 * {
 *   type: 'user' | 'document',
 *   id: string
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   invalidated: number,
 *   stats: CacheStats
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = nanoid();
  
  try {
    // Require authentication
    const authResult = await getUserFromAuth();
    if (!authResult.success) {
      return NextResponse.json(
        errorResponse(createError('unauthorized', 'Authentication required'), requestId),
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { type, id } = body;
    
    if (!type || !id) {
      return NextResponse.json(
        errorResponse(
          createError('validation_error', 'type and id are required'),
          requestId
        ),
        { status: 400 }
      );
    }
    
    let invalidated = 0;
    
    if (type === 'user') {
      // Invalidate all cache for user
      invalidated = await invalidateUserCache(id);
    } else if (type === 'document') {
      // Invalidate cache for specific document
      await invalidateDocumentCache(id);
      invalidated = 1;  // Approximation
    } else {
      return NextResponse.json(
        errorResponse(
          createError('validation_error', 'type must be "user" or "document"'),
          requestId
        ),
        { status: 400 }
      );
    }
    
    const stats = getCacheStats();
    
    return NextResponse.json(
      successResponse(
        {
          invalidated,
          stats,
        },
        requestId
      ),
      { status: 200 }
    );
    
  } catch (error) {
    return NextResponse.json(
      errorResponse(createError('search_failed', 'Invalidation failed'), requestId),
      { status: 500 }
    );
  }
}

/**
 * GET /api/cache/invalidate
 * 
 * Health check for cache service
 */
export async function GET() {
  const stats = getCacheStats();
  return NextResponse.json({
    status: 'healthy',
    service: 'cache',
    timestamp: new Date().toISOString(),
    redis: stats.redis.connected ? 'connected' : 'unavailable',
    embeddingHitRate: `${(stats.embedding.hitRate * 100).toFixed(1)}%`,
    queryHitRate: `${(stats.query.hitRate * 100).toFixed(1)}%`,
  });
}
