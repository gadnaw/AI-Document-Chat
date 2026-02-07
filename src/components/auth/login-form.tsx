'use client'

import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { formatAuthError } from '@/lib/errors'

interface LoginFormProps {
  /** URL to redirect to after successful login */
  redirectTo?: string
  /** Callback when user clicks signup link */
  onSwitchToSignup?: () => void
}

/**
 * Login form component with email/password authentication.
 * 
 * Features:
 * - Client-side validation for email format and password length
 * - Loading state during authentication
 * - User-friendly error messages (no system details exposed)
 * - Redirect after successful login
 * 
 * @example
 * ```tsx
 * <LoginForm 
 *   redirectTo="/dashboard" 
 *   onSwitchToSignup={() => setActiveTab('signup')}
 * />
 * ```
 */
export function LoginForm({ redirectTo = '/dashboard', onSwitchToSignup }: LoginFormProps) {
  const { signIn, loading } = useAuth()
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({})

  /**
   * Validate form inputs before submission
   */
  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {}
    
    // Email validation
    if (!email) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    // Password validation
    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    if (!validateForm()) {
      return
    }
    
    const { error: authError } = await signIn(email, password)
    
    if (authError) {
      setError(formatAuthError(authError))
      return
    }
    
    // Successful login - redirect
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-center">Welcome Back</h2>
        <p className="text-sm text-gray-500 text-center">
          Sign in to your account to continue
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-1">
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (validationErrors.email) {
              setValidationErrors((prev) => ({ ...prev, email: undefined }))
            }
          }}
          placeholder="you@example.com"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            validationErrors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
          autoComplete="email"
        />
        {validationErrors.email && (
          <p className="text-sm text-red-600">{validationErrors.email}</p>
        )}
      </div>
      
      <div className="space-y-1">
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (validationErrors.password) {
              setValidationErrors((prev) => ({ ...prev, password: undefined }))
            }
          }}
          placeholder="••••••••"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            validationErrors.password ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
          autoComplete="current-password"
        />
        {validationErrors.password && (
          <p className="text-sm text-red-600">{validationErrors.password}</p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      
      {onSwitchToSignup && (
        <p className="text-sm text-center text-gray-600">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Sign up
          </button>
        </p>
      )}
    </form>
  )
}
