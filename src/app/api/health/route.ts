import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Health Check Endpoint
 * 
 * Provides system health status including:
 * - Database connectivity
 * - External service availability
 * - System resources
 * 
 * GET /api/health
 */

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: ServiceHealth;
    supabase: ServiceHealth;
    openai: ServiceHealth;
    redis: ServiceHealth;
  };
  system: {
    memory: MemoryHealth;
    uptime: number;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

interface MemoryHealth {
  used: number;
  total: number;
  usagePercent: number;
}

/**
 * GET /api/health
 * Returns comprehensive health status
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: { status: 'up' },
      supabase: { status: 'up' },
      openai: { status: 'up' },
      redis: { status: 'up' },
    },
    system: {
      memory: {
        used: 0,
        total: 0,
        usagePercent: 0,
      },
      uptime: process.uptime(),
    },
  };

  // Check system memory
  try {
    const memoryUsage = process.memoryUsage();
    results.system.memory = {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
    };
  } catch (error) {
    console.warn('[Health Check] Memory check failed:', error);
  }

  // Check Supabase connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const supabaseStart = Date.now();
      
      const { error } = await supabase.from('users').select('id').limit(1).maybeSingle();
      
      results.services.supabase.latency = Date.now() - supabaseStart;
      
      if (error) {
        // Supabase might not have users table yet, but connection works
        if (error.code === '42P01' || error.message.includes('relation "users" does not exist')) {
          results.services.supabase.status = 'up';
          results.services.supabase.details = { note: 'Database connected, table not created' };
        } else {
          results.services.supabase.status = 'degraded';
          results.services.supabase.error = error.message;
        }
      } else {
        results.services.supabase.status = 'up';
      }
    } else {
      results.services.supabase.status = 'down';
      results.services.supabase.error = 'Missing Supabase credentials';
    }
  } catch (error) {
    results.services.supabase.status = 'down';
    results.services.supabase.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check OpenAI connectivity (lightweight check)
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (openaiKey) {
      // Only do a lightweight check in production
      if (process.env.NODE_ENV === 'production') {
        // In production, just verify the key format
        if (openaiKey.startsWith('sk-') && openaiKey.length > 20) {
          results.services.openai.status = 'up';
          results.services.openai.details = { note: 'API key configured' };
        } else {
          results.services.openai.status = 'degraded';
          results.services.openai.error = 'Invalid API key format';
        }
      } else {
        // In development, try a real API call (lightweight)
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: openaiKey });
        
        const openaiStart = Date.now();
        await openai.models.list({ limit: 1 });
        
        results.services.openai.latency = Date.now() - openaiStart;
        results.services.openai.status = 'up';
      }
    } else {
      results.services.openai.status = 'down';
      results.services.openai.error = 'OpenAI API key not configured';
    }
  } catch (error) {
    results.services.openai.status = 'down';
    results.services.openai.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check Redis connectivity
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      const redisStart = Date.now();
      
      // Use fetch for lightweight check
      const response = await fetch(`${redisUrl}/get/test-key`, {
        headers: {
          'Authorization': `Bearer ${redisToken}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      
      results.services.redis.latency = Date.now() - redisStart;

      if (response.ok || response.status === 404) {
        results.services.redis.status = 'up';
      } else {
        results.services.redis.status = 'degraded';
        results.services.redis.error = `Redis returned status ${response.status}`;
      }
    } else {
      // Redis is optional
      results.services.redis.status = 'up';
      results.services.redis.details = { note: 'Redis not configured (optional)' };
    }
  } catch (error) {
    // Redis is optional, so degraded is acceptable
    results.services.redis.status = 'degraded';
    results.services.redis.error = error instanceof Error ? error.message : 'Unknown error';
    results.services.redis.details = { note: 'Redis connection failed but is optional' };
  }

  // Determine overall status
  const serviceStatuses = Object.values(results.services).map(s => s.status);
  if (serviceStatuses.some(s => s === 'down')) {
    results.status = 'unhealthy';
  } else if (serviceStatuses.some(s => s === 'degraded')) {
    results.status = 'degraded';
  } else {
    results.status = 'healthy';
  }

  // Add request duration
  const totalDuration = Date.now() - startTime;
  const statusCode = results.status === 'healthy' ? 200 : 
                     results.status === 'degraded' ? 200 : 503;

  return NextResponse.json(results, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check-Duration': `${totalDuration}ms`,
    },
  });
}

/**
 * Simple health check for load balancers
 * Returns minimal response for health probes
 */
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
