import { ZodError } from 'zod';

/**
 * Structured error types for retrieval operations
 * Enables consistent error responses across API endpoints
 */
export type RetrievalErrorType = 
  | 'validation_error'
  | 'embedding_failed'
  | 'search_failed'
  | 'timeout'
  | 'no_results'
  | 'unauthorized'
  | 'rate_limited';

/**
 * Structured error response for API endpoints
 */
export interface RetrievalError {
  type: RetrievalErrorType;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  retryAfter?: number;  // For rate limiting
}

/**
 * Success response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: RetrievalError;
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * Creates a RetrievalError from various sources
 */
export function createError(
  type: RetrievalErrorType,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    recoverable?: boolean;
    retryAfter?: number;
  }
): RetrievalError {
  return {
    type,
    message,
    details: options?.details,
    recoverable: options?.recoverable ?? true,
    retryAfter: options?.retryAfter,
  };
}

/**
 * Converts error to RetrievalError with proper type classification
 */
export function classifyError(error: unknown): RetrievalError {
  if (error instanceof ZodError) {
    return createError(
      'validation_error',
      'Invalid request parameters',
      { 
        details: error.flatten().fieldErrors,
        recoverable: false,
      }
    );
  }
  
  if (error instanceof Error) {
    const message = error.message;
    
    if (message.includes('Embedding service') || message.includes('OpenAI')) {
      return createError('embedding_failed', message, { recoverable: true });
    }
    
    if (message.includes('Search service') || message.includes('database')) {
      return createError('search_failed', message, { recoverable: true });
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return createError('timeout', 'Search operation timed out', { recoverable: true });
    }
    
    if (message.includes('userId') || message.includes('authorization')) {
      return createError('unauthorized', 'Authentication required', { recoverable: false });
    }
  }
  
  return createError('search_failed', 'An unexpected error occurred', { recoverable: true });
}

/**
 * Generates JSON error response for API
 */
export function errorResponse(error: RetrievalError, requestId: string): ApiResponse<never> {
  return {
    success: false,
    error,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Generates JSON success response for API
 */
export function successResponse<T>(
  data: T,
  requestId: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}
