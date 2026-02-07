import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/retrieval/cache';
import { getConfig } from '@/lib/retrieval/cache-config';

/**
 * GET /api/cache/stats
 * 
 * Returns detailed cache performance statistics
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'json';
  
  const stats = getCacheStats();
  const config = getConfig();
  
  const report = {
    timestamp: new Date().toISOString(),
    configuration: {
      embeddingCache: config.embeddingCache.enabled,
      embeddingTTL: config.embeddingCache.ttlMs,
      queryCache: config.queryCache.enabled,
      queryTTL: config.queryCache.ttlMs,
    },
    performance: {
      embedding: {
        size: stats.embedding.size,
        hits: stats.embedding.hits,
        misses: stats.embedding.misses,
        hitRate: `${(stats.embedding.hitRate * 100).toFixed(2)}%`,
        hitRateDecimal: stats.embedding.hitRate,
      },
      query: {
        size: stats.query.size,
        hits: stats.query.hits,
        misses: stats.query.misses,
        hitRate: `${(stats.query.hitRate * 100).toFixed(2)}%`,
        hitRateDecimal: stats.query.hitRate,
      },
    },
    infrastructure: {
      redis: stats.redis.connected,
      redisPing: stats.redis.ping,
    },
  };
  
  if (format === 'json') {
    return NextResponse.json(report);
  }
  
  // Pretty-printed text format
  const text = `
Cache Performance Report
========================
Generated: ${report.timestamp}

Configuration
-------------
Embedding Cache: ${report.configuration.embeddingCache ? 'Enabled' : 'Disabled'}
  TTL: ${report.configuration.embeddingTTL}ms
Query Cache: ${report.configuration.queryCache ? 'Enabled' : 'Disabled'}
  TTL: ${report.configuration.queryTTL}ms

Performance
-----------
Embedding Cache:
  Size: ${report.performance.embedding.size}
  Hits: ${report.performance.embedding.hits}
  Misses: ${report.performance.embedding.misses}
  Hit Rate: ${report.performance.embedding.hitRate}

Query Cache:
  Size: ${report.performance.query.size}
  Hits: ${report.performance.query.hits}
  Misses: ${report.performance.query.misses}
  Hit Rate: ${report.performance.query.hitRate}

Infrastructure
--------------
Redis: ${report.infrastructure.redis ? 'Connected' : 'Unavailable'}
Ping: ${report.infrastructure.redisPing}ms
      `.trim();
      
  return new NextResponse(text, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
