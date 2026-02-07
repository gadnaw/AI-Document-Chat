import * as Sentry from '@sentry/nextjs';

/**
 * Sentry Client Configuration
 * 
 * Configures client-side error tracking and performance monitoring for browser applications.
 * This file is automatically loaded by @sentry/nextjs for client-side code.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Sample rates for tracing:
 * - 0.1 = 10% of transactions are traced
 * - This provides good visibility while minimizing performance overhead
 */
const TRACES_SAMPLE_RATE = 0.1;

/**
 * Error filtering configuration
 * Filters out known non-actionable errors to reduce noise
 */
const BEFORE_SEND_FILTER = (event: any, hint: any) => {
  // Filter out network errors that are expected in normal operation
  const errorMessage = hint.originalException?.message || '';
  
  if (errorMessage.includes('NetworkError')) {
    return null; // Ignore network errors
  }
  
  if (errorMessage.includes('Failed to fetch')) {
    return null; // Ignore fetch failures
  }
  
  if (errorMessage.includes('AbortError')) {
    return null; // Ignore abort errors from cancelled requests
  }
  
  // Filter out browser extension errors
  if (errorMessage.includes('Extension') || errorMessage.includes('chrome-extension')) {
    return null;
  }
  
  // Filter out non-serious React warnings in production
  if (process.env.NODE_ENV === 'production') {
    if (errorMessage.includes('Warning:') && !errorMessage.includes('Error:')) {
      return null;
    }
  }
  
  return event; // Keep all other errors
};

/**
 * Initialize Sentry for client-side monitoring
 */
if (process.env.NODE_ENV !== 'development' && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    
    // Performance monitoring
    tracesSampleRate: TRACES_SAMPLE_RATE,
    
    // Session replay for debugging user issues
    replaysSessionSampleRate: 0.01, // 1% of sessions
    replaysOnErrorSampleRate: 0.1,  // 10% of sessions with errors
    
    // Integration configuration
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration({
        useEffect: true,
        useLocation: true,
      }),
      // Session replay for user session debugging
      Sentry.replayIntegration({
        maskAllText: false, // Don't mask all text (user content is visible for debugging)
        blockAllMedia: false, // Don't block media (images visible for debugging)
      }),
    ],
    
    // Error filtering
    beforeSend: BEFORE_SEND_FILTER,
    
    // Set consistent transaction name format
    transactionNamingScheme: 'route',
    
    // Attach additional context
    initialScope: {
      tags: {
        component: 'client',
        environment: SENTRY_ENVIRONMENT,
      },
    },
    
    // Configure error grouping
    // This helps group similar errors together in the Sentry dashboard
    stackItemLimit: 50,
    
    // Enable debug mode in development
    debug: process.env.NODE_ENV === 'development',
  });
}

/**
 * Client-side error capture helper
 * Provides a simple API for capturing errors from user actions
 */
export function captureClientError(
  error: Error,
  context?: {
    userAction?: string;
    component?: string;
    userId?: string;
    additionalData?: Record<string, any>;
  }
) {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured, error not captured:', error.message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.userAction) {
      scope.setTag('user_action', context.userAction);
    }
    if (context?.component) {
      scope.setTag('component', context.component);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
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
 * Capture client-side messages for monitoring
 */
export function captureClientMessage(
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
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
}

/**
 * Set user context for all subsequent errors
 */
export function setSentryUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clear user context (on logout)
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
 * Start a custom transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startInactiveSpan({
    name,
    op,
    onlyIf: () => process.env.NODE_ENV !== 'development',
  });
}

/**
 * Performance monitoring helper for specific operations
 */
export function monitorPerformance<T>(
  operationName: string,
  operation: () => T
): T {
  const transaction = startTransaction(operationName, 'operation');
  try {
    const result = operation();
    
    // Mark transaction as successful
    if (transaction) {
      transaction.setStatus(Sentry.SpanStatus.Ok);
      transaction.finish();
    }
    
    return result;
  } catch (error) {
    // Mark transaction as errored
    if (transaction) {
      transaction.setStatus(Sentry.SpanStatus.InternalError);
      transaction.finish();
    }
    throw error;
  }
}

// Export Sentry instance for advanced usage
export { Sentry };
