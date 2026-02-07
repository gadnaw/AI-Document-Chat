/**
 * Application configuration export with runtime validation.
 * This module provides type-safe access to environment variables
 * and fails fast on startup if configuration is invalid.
 */

import { validateEnv, isBrowser } from './validation'

/**
 * Application configuration type derived from validated environment variables.
 */
export interface AppConfig {
  supabase: {
    /** Public Supabase project URL */
    url: string
    /** Public anon key for client-side operations */
    anonKey: string
    /** Service role key for server-side privileged operations */
    serviceRoleKey: string
  }
  openai: {
    /** OpenAI API key (undefined if not configured) */
    apiKey: string | undefined
  }
  app: {
    /** Public application URL */
    url: string
    /** Public application name */
    name: string
  }
}

/**
 * Validated application configuration.
 * Throws on import if environment variables are invalid.
 * 
 * @example
 * ```typescript
 * import { config } from '@/lib/config'
 * 
 * console.log('Supabase URL:', config.supabase.url)
 * console.log('App name:', config.app.name)
 * ```
 */
let config: AppConfig

try {
  const validated = validateEnv()
  
  config = {
    supabase: {
      url: validated.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: validated.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: validated.SUPABASE_SERVICE_ROLE_KEY,
    },
    openai: {
      apiKey: validated.OPENAI_API_KEY,
    },
    app: {
      url: validated.NEXT_PUBLIC_APP_URL,
      name: validated.NEXT_PUBLIC_APP_NAME,
    },
  }
} catch (validationError) {
  // Log the error and re-throw to prevent app startup
  if (isBrowser()) {
    console.error('❌ Configuration error (browser):', validationError)
    throw validationError
  }
  
  console.error('❌ Environment configuration error:')
  console.error((validationError as Error).message)
  throw validationError
}

/**
 * Exported configuration object for use throughout the application.
 * This is validated once at import time.
 */
export { config }

/**
 * Supabase configuration convenience exports.
 */
export const supabaseConfig = {
  url: config.supabase.url,
  anonKey: config.supabase.anonKey,
  serviceRoleKey: config.supabase.serviceRoleKey,
}

/**
 * OpenAI configuration convenience exports.
 */
export const openaiConfig = {
  apiKey: config.openai.apiKey,
}

/**
 * App configuration convenience exports.
 */
export const appConfig = {
  url: config.app.url,
  name: config.app.name,
}
