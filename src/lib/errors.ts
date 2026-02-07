import type { AuthError } from '@supabase/supabase-js'

/**
 * Custom application error class with user-friendly message support.
 * Used throughout the application for consistent error handling.
 */
export class AppError extends Error {
  /** User-friendly message safe to display in UI */
  public readonly userMessage: string
  /** Error code for programmatic handling */
  public readonly code: string
  /** Original error for debugging */
  public readonly originalError?: unknown

  constructor(
    message: string,
    options: {
      userMessage?: string
      code?: string
      originalError?: unknown
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.userMessage = options.userMessage ?? 'An unexpected error occurred. Please try again.'
    this.code = options.code ?? 'UNKNOWN_ERROR'
    this.originalError = options.originalError
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
  constructor(message: string, userMessage?: string, originalError?: unknown) {
    super(message, {
      userMessage: userMessage ?? 'Authentication failed. Please try again.',
      code: 'AUTH_ERROR',
      originalError,
    })
    this.name = 'AuthenticationError'
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, {
      userMessage: userMessage ?? 'Please check your input and try again.',
      code: 'VALIDATION_ERROR',
    })
    this.name = 'ValidationError'
  }
}

/**
 * Storage error class
 */
export class StorageError extends AppError {
  constructor(message: string, userMessage?: string, originalError?: unknown) {
    super(message, {
      userMessage: userMessage ?? 'Failed to access storage. Please try again.',
      code: 'STORAGE_ERROR',
      originalError,
    })
    this.name = 'StorageError'
  }
}

/**
 * API error class
 */
export class APIError extends AppError {
  public readonly statusCode?: number

  constructor(
    message: string,
    options: {
      userMessage?: string
      statusCode?: number
      originalError?: unknown
    } = {}
  ) {
    super(message, {
      userMessage: options.userMessage ?? 'Request failed. Please try again.',
      code: 'API_ERROR',
      originalError: options.originalError,
    })
    this.name = 'APIError'
    this.statusCode = options.statusCode
  }
}

/**
 * Mapping of Supabase auth error codes to user-friendly messages.
 * These messages are safe to show to users.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Sign in errors
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'invalid_grant': 'Invalid email or password. Please try again.',
  'user_not_found': 'No account found with this email.',
  'email_not_confirmed': 'Please confirm your email address before signing in.',
  
  // Sign up errors
  'user_already_exists': 'An account with this email already exists.',
  'weak_password': 'Password is too weak. Please use a stronger password.',
  'signup_disabled': 'Sign up is currently disabled.',
  
  // Session errors
  'session_expired': 'Your session has expired. Please sign in again.',
  'invalid_token': 'Your session has expired. Please sign in again.',
  'refresh_token_not_found': 'Your session has expired. Please sign in again.',
  
  // Rate limiting
  'over_request_rate_limit': 'Too many requests. Please wait a moment and try again.',
  'over_email_send_rate_limit': 'Too many email requests. Please wait a moment.',
  
  // Network errors
  'network_error': 'Network error. Please check your connection.',
  'fetch_error': 'Network error. Please check your connection.',
}

/**
 * Format a Supabase AuthError into a user-friendly message.
 * Logs full error details for debugging while returning safe message for UI.
 * 
 * @param error - The auth error from Supabase
 * @returns User-friendly error message
 * 
 * @example
 * ```typescript
 * const { error } = await signIn(email, password)
 * if (error) {
 *   setErrorMessage(formatAuthError(error))
 * }
 * ```
 */
export function formatAuthError(error: AuthError | null): string {
  if (!error) {
    return 'An unexpected error occurred. Please try again.'
  }

  // Log full error for debugging (server-side or development)
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
    console.error('Auth error:', {
      message: error.message,
      status: error.status,
      code: error.code,
    })
  }

  // Check for known error codes
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code]
  }

  // Check for common error message patterns
  const message = error.message.toLowerCase()
  
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return AUTH_ERROR_MESSAGES['invalid_credentials']
  }
  
  if (message.includes('email not confirmed')) {
    return AUTH_ERROR_MESSAGES['email_not_confirmed']
  }
  
  if (message.includes('already registered') || message.includes('already exists')) {
    return AUTH_ERROR_MESSAGES['user_already_exists']
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return AUTH_ERROR_MESSAGES['network_error']
  }
  
  if (message.includes('rate limit')) {
    return AUTH_ERROR_MESSAGES['over_request_rate_limit']
  }

  // Default fallback - don't expose raw error message
  return 'An error occurred during authentication. Please try again.'
}

/**
 * Format a generic error into a user-friendly message.
 * 
 * @param error - Any error object
 * @returns User-friendly error message
 */
export function formatError(error: unknown): string {
  // Handle AppError instances
  if (error instanceof AppError) {
    return error.userMessage
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    // Log for debugging
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
      console.error('Error:', error)
    }

    // Check for network errors
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('fetch')) {
      return 'Network error. Please check your connection.'
    }

    // Don't expose raw error messages
    return 'An unexpected error occurred. Please try again.'
  }

  // Unknown error type
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Retry a function with exponential backoff.
 * Useful for transient network errors.
 * 
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Result of the function
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => uploadDocument(file),
 *   3,
 *   1000
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry on final attempt
      if (attempt === maxRetries) {
        break
      }

      // Only retry on transient errors
      if (!isRetryableError(error)) {
        throw error
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Check if an error is retryable (transient network error).
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('econnreset')
    )
  }
  return false
}

/**
 * Type guard for checking if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error
}
