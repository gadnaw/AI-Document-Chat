import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { User, Session } from '@supabase/supabase-js'

/**
 * Get the current user from server-side context.
 * Use this in Server Components or API Routes.
 * 
 * @returns User object if authenticated, null otherwise
 * 
 * @example
 * ```typescript
 * // In a Server Component
 * export default async function ProfilePage() {
 *   const user = await getUser()
 *   if (!user) {
 *     redirect('/auth')
 *   }
 *   return <Profile user={user} />
 * }
 * ```
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error('Error getting user:', error.message)
    return null
  }
  
  return user
}

/**
 * Get the current session from server-side context.
 * Use this when you need both user and session data.
 * 
 * @returns Session object if authenticated, null otherwise
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Error getting session:', error.message)
    return null
  }
  
  return session
}

/**
 * Require authentication for a page or API route.
 * Redirects to login if not authenticated.
 * 
 * @param redirectTo - Where to send unauthenticated users (default: /auth)
 * @returns User object (guaranteed non-null since it redirects otherwise)
 * 
 * @example
 * ```typescript
 * // In a Server Component
 * export default async function SettingsPage() {
 *   const user = await requireAuth('/auth?redirectTo=/settings')
 *   // User is guaranteed to be authenticated here
 *   return <Settings user={user} />
 * }
 * ```
 */
export async function requireAuth(redirectTo: string = '/auth'): Promise<User> {
  const user = await getUser()
  
  if (!user) {
    redirect(redirectTo)
  }
  
  return user
}

/**
 * Get authorization headers for authenticated API calls.
 * Use when making server-to-server requests that need authentication.
 * 
 * @returns Headers object with Authorization bearer token, or empty if no session
 * 
 * @example
 * ```typescript
 * // In a server action or API route
 * const headers = await getSessionHeaders()
 * const response = await fetch('/api/protected', { headers })
 * ```
 */
export async function getSessionHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  
  if (!session) {
    return {}
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
  }
}

/**
 * Type guard to check if user is authenticated.
 * Useful for conditional rendering in server components.
 * 
 * @returns True if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser()
  return user !== null
}

/**
 * Get user ID if authenticated.
 * Convenience function for when you only need the ID.
 * 
 * @returns User ID string or null
 */
export async function getUserId(): Promise<string | null> {
  const user = await getUser()
  return user?.id ?? null
}
