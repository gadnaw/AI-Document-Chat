'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { User, Session, AuthError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Authentication context state type
 */
interface AuthContextState {
  user: User | null
  session: Session | null
  loading: boolean
  supabase: SupabaseClient<Database>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, options?: { data?: Record<string, unknown> }) => Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }>
  signOut: () => Promise<{ error: AuthError | null }>
}

/**
 * Default context value - throws if used outside provider
 */
const AuthContext = createContext<AuthContextState | undefined>(undefined)

/**
 * Props for AuthProvider component
 */
interface AuthProviderProps {
  children: ReactNode
}

/**
 * Authentication provider component that wraps the application
 * and provides authentication state and methods to all children.
 * 
 * Features:
 * - Initializes Supabase client for browser environment
 * - Listens to auth state changes (login, logout, token refresh)
 * - Provides signIn, signUp, signOut methods
 * - Handles session refresh automatically
 * 
 * @example
 * ```tsx
 * // In your app layout
 * export default function RootLayout({ children }) {
 *   return (
 *     <AuthProvider>
 *       {children}
 *     </AuthProvider>
 *   )
 * }
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize Supabase client for browser
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL ' +
        'and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
      )
    }

    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  })

  // Set up auth state listener on mount
  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setLoading(false)

        // Handle specific auth events
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', currentSession?.user?.email)
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out')
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed')
        } else if (event === 'USER_UPDATED') {
          console.log('User profile updated')
        }
      }
    )

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    options?: { data?: Record<string, unknown> }
  ) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: options?.data,
        },
      })

      // Check if email confirmation is required
      const needsEmailConfirmation = !error && data.user && !data.session ? true : undefined

      return { error, needsEmailConfirmation }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  /**
   * Sign out the current user
   */
  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const value: AuthContextState = {
    user,
    session,
    loading,
    supabase,
    signIn,
    signUp,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 * 
 * @returns Authentication state and methods
 * @throws Error if used outside of AuthProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, signOut, loading } = useAuth()
 *   
 *   if (loading) return <Spinner />
 *   if (!user) return <LoginPrompt />
 *   
 *   return (
 *     <div>
 *       Welcome, {user.email}!
 *       <button onClick={() => signOut()}>Log out</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

export { AuthContext }
export type { AuthContextState }
