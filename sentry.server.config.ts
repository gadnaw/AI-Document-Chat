import * as Sentry from '@sentry/node';

/**
 * Sentry Server Configuration
 * 
 * Configures server-side error tracking and performance monitoring for Node.js/Next.js API routes.
 * This file is automatically loaded by @sentry/nextjs for server-side code.
 */

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Sample rates for tracing:
 * - 0.1 = 10% of transactions are traced
 * - This provides good visibility while minimizing performance overhead
 */
const TRACES_SAMPLE_RATE = 0.1;

/**
 * Server-specific error filtering
 * Filters out expected server-side conditions that don't need alerting
 */
const BEFORE_SEND_FILTER = (event: any, hint: any) => {
  const errorMessage = hint.originalException?.message || '';
  
  // Filter out expected database disconnections during maintenance
  if (errorMessage.includes('Connection terminated') && 
      process.env.NODE_ENV === 'production') {
    // Still capture but with lower severity
    event.level = 'warning';
    event.tags = event.tags || {};
    event.tags.maintenance = 'true';
    return event;
  }
  
  // Filter out rate limit errors (expected behavior)
  if (errorMessage.includes('rate limit') || errorMessage.includes('Too Many Requests')) {
    event.level = 'warning';
    return null; // Don't capture rate limit errors as they're expected
  }
  
  // Filter out validation errors (handled gracefully by API)
  if (errorMessage.includes('ValidationError') || errorMessage.includes('invalid')) {
    event.level = 'info';
    return null; // Don't capture validation errors
  }
  
  // Filter out authentication errors for public endpoints
  if (errorMessage.includes('Unauthorized') || errorMessage.includes('Not authenticated')) {
    event.level = 'info';
    return null; // Don't capture auth errors for public endpoints
  }
  
  return event; // Keep all other errors
};

/**
 * Initialize Sentry for server-side monitoring
 */
if (process.env.NODE_ENV !== 'development' && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    
    // Performance monitoring
    tracesSampleRate: TRACES_SAMPLE_RATE,
    
    // Integration configuration for server
    integrations: [
      // Express integration for API route tracing
      Sentry.expressIntegration({
        app: undefined, // Will be set by @sentry/nextjs automatically
      }),
      // HTTP integration for outbound requests
      Sentry.httpIntegration({
        tracing: true,
      }),
      // PostgreSQL integration for database query monitoring
      // Note: Requires pg integration package if using raw pg
      // Sentry.postgresIntegration(),
    ],
    
    // Error filtering
    beforeSend: BEFORE_SEND_FILTER,
    
    // Set consistent transaction naming
    transactionNamingScheme: 'route',
    
    // Local variables for debugging (development only)
    includeLocalVariables: process.env.NODE_ENV === 'development',
    
    // Attach request data to errors
    requestBodies: 'never', // Don't capture request bodies to avoid sensitive data
    
    // Initial scope configuration
    initialScope: {
      tags: {
        component: 'server',
        environment: SENTRY_ENVIRONMENT,
      },
    },
    
    // Error grouping configuration
    stackItemLimit: 50,
    
    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',
  });
}

/**
 * Server-side error capture helper
 * Provides a structured API for capturing server errors
 */
export function captureServerError(
  error: Error,
  context?: {
    endpoint?: string;
    method?: string;
    userId?: string;
    requestId?: string;
    additionalData?: Record<string, any>;
  }
) {
  if (!SENTRY_DSN) {
    console.error('[Sentry Disabled] Server error:', error.message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.endpoint) {
      scope.setTag('endpoint', context.endpoint);
    }
    if (context?.method) {
      scope.setTag('method', context.method);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.requestId) {
      scope.setTag('request_id', context.requestId);
    }
    if (context?.additionalData) {
      Object.entries(context.additionalData).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    
    Sentry.captureException(error);
  });
}

/**
 * Capture server-side messages for monitoring
 */
export function captureServerMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) {
    console.log(`[${level}] ${message}`, context || '');
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag('component', 'server');
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
}

/**
 * Set user context for authenticated requests
 */
export function setSentryUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clear user context
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Add custom context to errors
 */
export function setSentryContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context);
}

/**
 * Add tags to errors
 */
export function setSentryTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * API-specific error capture with structured response
 */
export function captureAPIError(
  error: Error,
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  },
  userId?: string
) {
  captureServerError(error, {
    endpoint: request.url,
    method: request.method,
    userId,
    additionalData: {
      headers: sanitizeHeaders(request.headers),
      body: sanitizeBody(request.body),
    },
  });
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined;
  
  const sensitiveFields = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  const sanitized: Record<string, string> = {};
  
  Object.entries(headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body?: any): any {
  if (!body) return undefined;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Performance monitoring for database operations
 */
export function monitorDBOperation<T>(
  operationName: string,
  query: string,
  operation: () => Promise<T>
): Promise<T> {
  const transaction = Sentry.startInactiveSpan({
    name: `db.${operationName}`,
    op: 'db.query',
    description: query.substring(0, 100), // First 100 chars of query
  });
  
  return operation().then(
    (result) => {
      transaction.setStatus(Sentry.SpanStatus.Ok);
      transaction.finish();
      return result;
    },
    (error) => {
      transaction.setStatus(Sentry.SpanStatus.InternalError);
      transaction.setData('error', error.message);
      transaction.finish();
      throw error;
    }
  );
}

/**
 * Performance monitoring for external API calls
 */
export function monitorExternalCall<T>(
  serviceName: string,
  endpoint: string,
  operation: () => Promise<T>
): Promise<T> {
  const transaction = Sentry.startInactiveSpan({
    name: `external.${serviceName}`,
    op: 'http.client',
    description: endpoint,
  });
  
  return operation().then(
    (result) => {
      transaction.setStatus(Sentry.SpanStatus.Ok);
      transaction.finish();
      return result;
    },
    (error) => {
      transaction.setStatus(new Sentry.SpanStatus(error.statusCode || 500, 'unknown_error'));
      transaction.setData('error', error.message);
      transaction.finish();
      throw error;
    }
  );
}

/**
 * Create a breadcrumb for user actions
 */
export function addSentryBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    type: 'default',
  });
}

// Export Sentry instance for advanced usage
export { Sentry };
