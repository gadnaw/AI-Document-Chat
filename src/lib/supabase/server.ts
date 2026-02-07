import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr'
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
 * @param useServiceRole - Whether to use service role key (default: false uses anon key)
 * @returns Typed Supabase client instance for server environments
 * 
 * @example
 * ```typescript
 * // Server component - read auth state from cookies
 * const supabase = await createServerClient()
 * const { data: { user } } = await supabase.auth.getUser()
 * 
 * // API route with service role - bypass RLS
 * const supabase = await createServerClient(true)
 * await supabase.from('users').select('*')
 * ```
 */
export async function createServerClient(useServiceRole: boolean = false) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL ' +
      'and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }

  // Use service role key only when explicitly requested for admin operations
  const key = useServiceRole ? supabaseServiceRoleKey : supabaseAnonKey
  
  if (useServiceRole && !supabaseServiceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This key is required ' +
      'for admin operations but should never be exposed to the client.'
    )
  }

  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(supabaseUrl, key!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // This can fail in some edge cases when headers are already sent
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        } catch {
          // This can fail in some edge cases
        }
      },
    },
  })
}

/**
 * Convenience function for server components needing auth state.
 * Uses anon key to respect RLS policies.
 */
export async function getServerSupabase() {
  return createServerClient(false)
}

/**
 * Convenience function for admin operations that bypass RLS.
 * Only use in trusted server-side code.
 */
export async function getAdminSupabase() {
  return createServerClient(true)
}
