import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Routes that require authentication.
 * Users will be redirected to /auth if not logged in.
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/documents',
  '/chat',
  '/settings',
  '/profile',
]

/**
 * Routes that are only for unauthenticated users.
 * Logged-in users will be redirected to /dashboard.
 */
const AUTH_ROUTES = [
  '/auth',
  '/login',
  '/signup',
]

/**
 * Check if a path starts with any of the given prefixes
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
}

/**
 * Next.js middleware for route protection.
 * 
 * This middleware:
 * - Checks authentication status using Supabase session
 * - Redirects unauthenticated users away from protected routes
 * - Redirects authenticated users away from auth pages
 * - Refreshes session tokens automatically
 * 
 * @param request - The incoming request
 * @returns Response with possible redirect or updated cookies
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response to potentially modify cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // Static files like .ico, .png
  ) {
    return response
  }

  // Create Supabase client with cookie handling
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables not set')
    return response
  }

  const supabase = createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // Set cookie on request for downstream handlers
        request.cookies.set({
          name,
          value,
          ...options,
        })
        // Set cookie on response for browser
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        response.cookies.set({
          name,
          value,
          ...options,
        })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        response.cookies.set({
          name,
          value: '',
          ...options,
        })
      },
    },
  })

  // Get current session (this also refreshes the token if needed)
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Error getting session in middleware:', error.message)
  }

  const isAuthenticated = !!session

  // Check if route is protected
  const isProtectedRoute = matchesRoute(pathname, PROTECTED_ROUTES)
  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES)

  // Redirect unauthenticated users from protected routes to auth
  if (isProtectedRoute && !isAuthenticated) {
    const redirectUrl = new URL('/auth', request.url)
    // Preserve the original URL to redirect back after login
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && isAuthenticated) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dashboard'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return response
}

/**
 * Configure which routes the middleware applies to.
 * This matcher excludes static files and Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
