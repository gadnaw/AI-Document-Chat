import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './types'

/**
 * Creates a server Supabase client with cookie management for SSR authentication.
 * 
 * This client handles:
 * - Reading authentication state from cookies on GET requests
 * - Writing updated cookies after session refresh on POST requests
 * - Server-side operations with elevated privileges via service role key
 * 
 * @param forGET - Whether this client is for a GET request (read-only cookies)
 * @returns Typed Supabase client instance for server environments
 * 
 * @example
 * ```typescript
 * // GET request - read auth state from cookies
 * const supabase = createServerClient(true)
 * const { data: { user } } = await supabase.auth.getUser()
 * 
 * // POST request - refresh session and update cookies
 * const supabase = createServerClient(false)
 * await supabase.auth.exchangeCodeForSession(code)
 * ```
 */
export function createServerClient(forGET: boolean = true) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL ' +
      'is set in your environment.'
    )
  }

  // Server operations require service role key for elevated privileges
  if (!supabaseServiceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This key should only ' +
      'be used in server-side code and never exposed to the client.'
    )
  }

  const cookieStore = cookies()

  return createServerClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      get(name: string) {
        if (forGET) {
          return cookieStore.get(name)?.value
        }
        // For POST requests, we don't read cookies - they are handled by the session management
        return undefined
      },
      set(name: string, value: string, options: CookieOptions) {
        if (!forGET) {
          // Only set cookies on POST requests to avoid cache issues
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // The error here is typically related to headers being already sent
            // which can happen in some edge cases
          }
        }
      },
      remove(name: string, options: CookieOptions) {
        if (!forGET) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 })
          } catch {
            // Similar to above, this may fail if headers are already sent
          }
        }
      },
    },
  })
}

/**
 * Type-safe server Supabase client instance for GET requests.
 * Use this for server components that need to read auth state.
 */
export const supabaseServer = createServerClient(true)
