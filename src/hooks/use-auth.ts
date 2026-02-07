'use client'

import { useContext } from 'react'
import { AuthContext, type AuthContextState } from '@/components/auth-provider'
import type { User, Session, AuthError } from '@supabase/supabase-js'

/**
 * Re-export types for convenience
 */
export type { User, Session, AuthError }

/**
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 * 
 * @returns Authentication state and methods:
 * - `user`: Current authenticated user or null
 * - `session`: Current session with tokens or null
 * - `loading`: Whether auth state is being loaded
 * - `signIn`: Function to sign in with email/password
 * - `signOut`: Function to sign out
 * - `signUp`: Function to create new account
 * - `supabase`: Supabase client instance
 * 
 * @throws Error if used outside of AuthProvider
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { useAuth } from '@/hooks/use-auth'
 * 
 * function ProfileButton() {
 *   const { user, signOut, loading } = useAuth()
 *   
 *   if (loading) return <Spinner />
 *   
 *   if (!user) {
 *     return <Link href="/auth">Sign In</Link>
 *   }
 *   
 *   return (
 *     <button onClick={() => signOut()}>
 *       {user.email} - Sign Out
 *     </button>
 *   )
 * }
 * ```
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Wrap your app with <AuthProvider> to fix this error.'
    )
  }
  
  return context
}

/**
 * Type guard to check if user is authenticated
 */
export function isAuthenticated(auth: AuthContextState): auth is AuthContextState & { user: User; session: Session } {
  return auth.user !== null && auth.session !== null
}
