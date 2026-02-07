'use client'

import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { formatAuthError } from '@/lib/errors'

interface SignupFormProps {
  /** URL to redirect to after successful signup (if no email confirmation required) */
  redirectTo?: string
  /** Callback when user clicks login link */
  onSwitchToLogin?: () => void
}

/**
 * Signup form component with email/password registration.
 * 
 * Features:
 * - Client-side validation for email format and password strength
 * - Loading state during registration
 * - Handles email confirmation flow
 * - User-friendly error messages
 * 
 * @example
 * ```tsx
 * <SignupForm 
 *   redirectTo="/dashboard" 
 *   onSwitchToLogin={() => setActiveTab('login')}
 * />
 * ```
 */
export function SignupForm({ redirectTo = '/dashboard', onSwitchToLogin }: SignupFormProps) {
  const { signUp, loading } = useAuth()
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  /**
   * Validate form inputs before submission
   */
  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string; confirmPassword?: string } = {}
    
    // Email validation
    if (!email) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    // Password validation
    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, and a number'
    }
    
    // Confirm password validation
    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
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
    setSuccess(false)
    
    if (!validateForm()) {
      return
    }
    
    const { error: authError, needsEmailConfirmation } = await signUp(email, password)
    
    if (authError) {
      setError(formatAuthError(authError))
      return
    }
    
    if (needsEmailConfirmation) {
      // Email confirmation required
      setSuccess(true)
    } else {
      // Direct login (email confirmation disabled in Supabase)
      router.push(redirectTo)
      router.refresh()
    }
  }

  // Show success message if email confirmation needed
  if (success) {
    return (
      <div className="space-y-4 w-full max-w-sm">
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="text-green-800 font-medium mb-2">Check your email!</h3>
          <p className="text-green-700 text-sm">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            Please click the link to activate your account.
          </p>
        </div>
        
        <p className="text-sm text-center text-gray-600">
          Didn&apos;t receive the email?{' '}
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Try again
          </button>
        </p>
        
        {onSwitchToLogin && (
          <p className="text-sm text-center text-gray-600">
            Already confirmed?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-center">Create Account</h2>
        <p className="text-sm text-gray-500 text-center">
          Sign up to get started with AI Document Chat
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div className="space-y-1">
        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="signup-password"
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
          autoComplete="new-password"
        />
        {validationErrors.password && (
          <p className="text-sm text-red-600">{validationErrors.password}</p>
        )}
        <p className="text-xs text-gray-500">
          At least 8 characters with uppercase, lowercase, and a number
        </p>
      </div>
      
      <div className="space-y-1">
        <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700">
          Confirm Password
        </label>
        <input
          id="signup-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (validationErrors.confirmPassword) {
              setValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }))
            }
          }}
          placeholder="••••••••"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
          autoComplete="new-password"
        />
        {validationErrors.confirmPassword && (
          <p className="text-sm text-red-600">{validationErrors.confirmPassword}</p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
      
      {onSwitchToLogin && (
        <p className="text-sm text-center text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  )
}
