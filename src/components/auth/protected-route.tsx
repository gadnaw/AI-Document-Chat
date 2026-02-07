'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

interface ProtectedRouteProps {
  /** Child components to render if authenticated */
  children: ReactNode
  /** URL to redirect to if not authenticated */
  redirectTo?: string
  /** Custom loading component */
  loadingComponent?: ReactNode
}

/**
 * Client-side route protection component.
 * 
 * Use this to wrap pages or components that require authentication.
 * Works in conjunction with middleware for double protection.
 * 
 * Features:
 * - Shows loading state while checking authentication
 * - Redirects unauthenticated users to login
 * - Renders children only when authenticated
 * 
 * Note: This is a client-side check. For server-side protection,
 * use the middleware or getUser() in server components.
 * 
 * @example
 * ```tsx
 * // In a page component
 * export default function DashboardPage() {
 *   return (
 *     <ProtectedRoute redirectTo="/auth">
 *       <DashboardContent />
 *     </ProtectedRoute>
 *   )
 * }
 * ```
 */
export function ProtectedRoute({
  children,
  redirectTo = '/auth',
  loadingComponent,
}: ProtectedRouteProps) {
  const { user, session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Wait for auth state to load
    if (loading) return

    // Redirect if not authenticated
    if (!user || !session) {
      // Preserve current URL to redirect back after login
      const currentPath = window.location.pathname
      const redirectUrl = new URL(redirectTo, window.location.origin)
      
      if (currentPath !== '/' && !redirectTo.includes('redirectTo=')) {
        redirectUrl.searchParams.set('redirectTo', currentPath)
      }
      
      router.replace(redirectUrl.toString())
    }
  }, [user, session, loading, router, redirectTo])

  // Show loading state
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if not authenticated
  if (!user || !session) {
    return null
  }

  // Render children when authenticated
  return <>{children}</>
}
