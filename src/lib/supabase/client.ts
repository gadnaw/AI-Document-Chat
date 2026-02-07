import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

/**
 * Creates a browser Supabase client with cookie handling for SSR authentication.
 * 
 * This client is designed for use in client components where we need to:
 * - Authenticate users via browser cookies
 * - Persist auth state across page navigations
 * - Handle PKCE flow for OAuth and session refresh
 * 
 * @returns Typed Supabase client instance for browser environments
 * 
 * @example
 * ```typescript
 * 'use client'
 * import { createBrowserClient } from '@/lib/supabase/client'
 * 
 * const supabase = createBrowserClient()
 * const { data: { user } } = await supabase.auth.getUser()
 * ```
 */
export function createBrowserClient() {
  // Validate environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL ' +
      'and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Type-safe browser Supabase client instance.
 * Use this for client-side operations that require authentication.
 */
export const supabaseBrowser = createBrowserClient()
