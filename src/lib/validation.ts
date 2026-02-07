/**
 * Environment validation utilities for ensuring proper configuration
 * before application startup and runtime operations.
 */

/**
 * Required environment variables for Supabase authentication and database access.
 */
export const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

/**
 * Optional environment variables with defaults.
 */
export const OPTIONAL_ENV_VARS = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_NAME: 'AI Document Chat',
} as const

/**
 * Validates that required Supabase environment variables are set and properly formatted.
 * 
 * @throws Error if required variables are missing or improperly formatted
 * @returns Object with validated environment variables
 * 
 * @example
 * ```typescript
 * const env = validateEnv()
 * console.log('Supabase URL:', env.NEXT_PUBLIC_SUPABASE_URL)
 * ```
 */
export function validateEnv() {
  const errors: string[] = []

  // Check required Supabase variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName]
    
    if (!value) {
      errors.push(`Missing required environment variable: ${varName}`)
      continue
    }

    // Validate Supabase URL format
    if (varName === 'NEXT_PUBLIC_SUPABASE_URL') {
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
          errors.push(
            `NEXT_PUBLIC_SUPABASE_URL must use HTTPS protocol (or localhost for development). Got: ${value}`
          )
        }
        if (!url.hostname.includes('supabase.co') && url.hostname !== 'localhost') {
          errors.push(
            `NEXT_PUBLIC_SUPABASE_URL should be a Supabase project URL. Got: ${value}`
          )
        }
      } catch {
        errors.push(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${value}`)
      }
    }

    // Validate anon key format (JWT starts with eyJ)
    if (varName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      if (!value.startsWith('eyJ')) {
        errors.push(
          `NEXT_PUBLIC_SUPABASE_ANON_KEY should be a JWT token starting with 'eyJ'. Got: ${value.substring(0, 10)}...`
        )
      }
    }

    // Service role key should also be a JWT
    if (varName === 'SUPABASE_SERVICE_ROLE_KEY') {
      if (!value.startsWith('eyJ')) {
        errors.push(
          `SUPABASE_SERVICE_ROLE_KEY should be a JWT token starting with 'eyJ'. Got: ${value.substring(0, 10)}...`
        )
      }
    }
  }

  // Check OpenAI API key if provided
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey && !openaiKey.startsWith('sk-')) {
    errors.push(
      `OPENAI_API_KEY should start with 'sk-' for OpenAI API keys. Got: ${openaiKey.substring(0, 10)}...`
    )
  }

  // Report all errors at once
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment validation failed:',
      '',
      ...errors.map(err => `  • ${err}`),
      '',
      'Please configure your .env.local file with the correct values.',
      'See .env.local.example for the required format.',
    ].join('\n')

    throw new Error(errorMessage)
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || OPTIONAL_ENV_VARS.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || OPTIONAL_ENV_VARS.NEXT_PUBLIC_APP_NAME,
  }
}

/**
 * Check if running in browser environment.
 * Prevents server-only environment variables from leaking to client bundles.
 * 
 * @returns true if running in browser, false if on server
 * 
 * @example
 * ```typescript
 * if (isBrowser()) {
 *   // Safe to access NEXT_PUBLIC_* variables
 * }
 * ```
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Validates a single environment variable.
 * Useful for runtime validation of dynamic values.
 * 
 * @param name - Environment variable name
 * @param value - Value to validate
 * @param type - Expected type of value
 * @returns Validation result with success status and error message if failed
 */
export function validateEnvVar(
  name: string,
  value: string | undefined,
  type: 'url' | 'jwt' | 'apiKey' | 'required'
): { valid: boolean; error?: string } {
  if (type === 'required') {
    if (!value) {
      return { valid: false, error: `${name} is required` }
    }
    return { valid: true }
  }

  if (!value) {
    // For non-required types, undefined is acceptable
    return { valid: true }
  }

  switch (type) {
    case 'url':
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
          return { valid: false, error: `${name} must use HTTPS` }
        }
      } catch {
        return { valid: false, error: `${name} is not a valid URL` }
      }
      break

    case 'jwt':
      if (!value.startsWith('eyJ')) {
        return { valid: false, error: `${name} must be a JWT token` }
      }
      break

    case 'apiKey':
      if (!value.startsWith('sk-')) {
        return { valid: false, error: `${name} should be an OpenAI API key starting with 'sk-'` }
      }
      break
  }

  return { valid: true }
}
