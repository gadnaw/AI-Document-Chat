import { captureAPIError } from '../../sentry.server.config';

/**
 * Standard API Error Codes
 */
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_ERROR = 'GATEWAY_ERROR',
}

/**
 * HTTP Status Codes Mapping
 */
const ErrorCodeToStatus: Record<ApiErrorCode, number> = {
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorCode.AUTHENTICATION_ERROR]: 401,
  [ApiErrorCode.AUTHORIZATION_ERROR]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.RATE_LIMITED]: 429,
  [ApiErrorCode.TOO_MANY_REQUESTS]: 429,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCode.GATEWAY_ERROR]: 502,
};

/**
 * API Error Response Interface
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path?: string;
    requestId?: string;
  };
}

/**
 * API Success Response Interface
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * User-friendly error messages
 */
const UserFriendlyMessages: Record<ApiErrorCode, string> = {
  [ApiErrorCode.VALIDATION_ERROR]: 'The request data is invalid. Please check your input.',
  [ApiErrorCode.BAD_REQUEST]: 'The request could not be processed.',
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 'The request data is invalid.',
  [ApiErrorCode.AUTHENTICATION_ERROR]: 'Authentication is required. Please log in.',
  [ApiErrorCode.AUTHORIZATION_ERROR]: 'You do not have permission to perform this action.',
  [ApiErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ApiErrorCode.CONFLICT]: 'There was a conflict with the current state.',
  [ApiErrorCode.RATE_LIMITED]: 'Too many requests. Please try again later.',
  [ApiErrorCode.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
  [ApiErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
  [ApiErrorCode.GATEWAY_ERROR]: 'The server received an invalid response.',
};

/**
 * Create an API error response
 */
export function createApiError(
  code: ApiErrorCode,
  message?: string,
  details?: Record<string, any>,
  options?: {
    path?: string;
    requestId?: string;
    userId?: string;
  }
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message: message || UserFriendlyMessages[code] || 'An error occurred',
      timestamp: new Date().toISOString(),
      ...(options?.path && { path: options.path }),
      ...(options?.requestId && { requestId: options.requestId }),
      ...(details && { details }),
    },
  };

  return response;
}

/**
 * Create a validation error response
 */
export function createValidationError(
  errors: Record<string, string | string[]>,
  options?: { path?: string; requestId?: string }
): ApiErrorResponse {
  return createApiError(
    ApiErrorCode.VALIDATION_ERROR,
    'Request validation failed',
    errors,
    options
  );
}

/**
 * Create an authentication error response
 */
export function createAuthError(
  message: string = 'Authentication required',
  options?: { path?: string; requestId?: string }
): ApiErrorResponse {
  return createApiError(
    ApiErrorCode.AUTHENTICATION_ERROR,
    message,
    undefined,
    options
  );
}

/**
 * Create an authorization error response
 */
export function createForbiddenError(
  message: string = 'You do not have permission to access this resource',
  options?: { path?: string; requestId?: string }
): ApiErrorResponse {
  return createApiError(
    ApiErrorCode.AUTHORIZATION_ERROR,
    message,
    undefined,
    options
  );
}

/**
 * Create a not found error response
 */
export function createNotFoundError(
  resource: string,
  options?: { path?: string; requestId?: string }
): ApiErrorResponse {
  return createApiError(
    ApiErrorCode.NOT_FOUND,
    `${resource} not found`,
    undefined,
    options
  );
}

/**
 * Create a rate limit error response
 */
export function createRateLimitError(
  retryAfter?: number,
  options?: { path?: string; requestId?: string }
): ApiErrorResponse {
  const details = retryAfter ? { retryAfter } : undefined;
  return createApiError(
    ApiErrorCode.RATE_LIMITED,
    'Too many requests. Please slow down.',
    details,
    options
  );
}

/**
 * Create an internal error response
 */
export function createInternalError(
  message: string = 'An unexpected error occurred',
  options?: { path?: string; requestId?: string; userId?: string }
): ApiErrorResponse {
  return createApiError(
    ApiErrorCode.INTERNAL_ERROR,
    message,
    undefined,
    options
  );
}

/**
 * Handle and format API errors
 */
export function handleApiError(
  error: any,
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  },
  options?: {
    userId?: string;
    requestId?: string;
    silent?: boolean;
  }
): ApiErrorResponse {
  // Log error to Sentry for monitoring
  if (!options?.silent) {
    captureAPIError(error, request, options?.userId);
  }

  // Handle known error types
  if (error instanceof ValidationError) {
    return createValidationError(error.errors, {
      path: request.url,
      requestId: options?.requestId,
    });
  }

  if (error instanceof AuthenticationError) {
    return createAuthError(error.message, {
      path: request.url,
      requestId: options?.requestId,
    });
  }

  if (error instanceof AuthorizationError) {
    return createForbiddenError(error.message, {
      path: request.url,
      requestId: options?.requestId,
    });
  }

  if (error instanceof NotFoundError) {
    return createNotFoundError(error.resource, {
      path: request.url,
      requestId: options?.requestId,
    });
  }

  if (error instanceof RateLimitError) {
    return createRateLimitError(error.retryAfter, {
      path: request.url,
      requestId: options?.requestId,
    });
  }

  if (error instanceof ApiError) {
    return createApiError(
      error.code,
      error.message,
      error.details,
      {
        path: request.url,
        requestId: options?.requestId,
      }
    );
  }

  // Handle unknown errors - log without exposing stack traces to client
  console.error('[API Error] Unknown error:', {
    message: error?.message || error,
    url: request.url,
    method: request.method,
  });

  // Only expose sanitized error message in development
  const sanitizedMessage = process.env.NODE_ENV === 'development'
    ? sanitizeErrorMessage(error?.message) || 'Unknown error'
    : 'An unexpected error occurred';

  return createInternalError(
    sanitizedMessage,
    {
      path: request.url,
      requestId: options?.requestId,
    }
  );
}

/**
 * Custom Error Classes for API
 */

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: Record<string, any>;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends Error {
  errors: Record<string, string | string[]>;

  constructor(errors: Record<string, string | string[]>) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  resource: string;

  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

export class RateLimitError extends Error {
  retryAfter?: number;

  constructor(message: string = 'Rate limited', retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: any): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorizationError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof ApiError) {
    return ErrorCodeToStatus[error.code] || 500;
  }
  return 500;
}

/**
 * Safe API handler wrapper
 * Catches errors and returns proper JSON responses
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  },
  options?: {
    userId?: string;
    requestId?: string;
  }
): Promise<ApiSuccessResponse<T> | ApiErrorResponse> {
  return handler()
    .then((data) => ({
      success: true,
      data,
    } as ApiSuccessResponse<T>))
    .catch((error) =>
      handleApiError(error, request, options)
    );
}

/**
 * Async API handler wrapper with Next.js App Router
 */
export function createApiHandler<T>(
  handler: (request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
    query: Record<string, string>;
    userId?: string;
  }) => Promise<T>,
  options?: {
    requireAuth?: boolean;
    userId?: string;
  }
) {
  return async function apiHandler(
    request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: any;
      query: Record<string, string>;
    }
  ): Promise<ApiSuccessResponse<T> | ApiErrorResponse> {
    const requestId = request.headers['x-request-id'] || generateRequestId();

    return withErrorHandling(
      async () => {
        // Check authentication if required
        if (options?.requireAuth && !options?.userId && !request.headers['x-user-id']) {
          throw new AuthenticationError();
        }

        const userId = options?.userId || request.headers['x-user-id'];

        return handler({
          ...request,
          userId,
        });
      },
      {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
      },
      {
        userId: options?.userId || request.headers['x-user-id'],
        requestId,
      }
    );
  };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Sanitize error messages to prevent information disclosure
 * Removes file paths, stack traces, and sensitive data from error messages
 */
function sanitizeErrorMessage(message: string | undefined): string {
  if (!message) return 'Unknown error';

  // Remove file paths and line numbers
  let sanitized = message
    .replace(/in\s+\/[\w\/\.-]+:\d+:\d+/gi, '')  // Remove file paths
    .replace(/at\s+Object\.<anonymous>\s+\([^)]+\)/g, '')  // Remove stack trace frames
    .replace(/at\s+async\s+[^)]+\s*\([^)]*\)/g, '')  // Remove async stack frames
    .trim();

  // Truncate very long error messages
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized || 'An error occurred';
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  }
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

/**
 * Pagination helper
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): ApiSuccessResponse<T[]> {
  const totalPages = Math.ceil(total / limit);
  
  return successResponse(data, {
    page,
    limit,
    total,
    hasMore: page < totalPages,
  });
}
