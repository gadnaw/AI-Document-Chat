'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'

type AuthTab = 'login' | 'signup'

interface AuthFormsProps {
  /** Default tab to show */
  defaultTab?: AuthTab
  /** URL to redirect to after authentication */
  redirectTo?: string
}

/**
 * Combined authentication forms with tab switching.
 * 
 * Provides a clean interface for both login and signup flows
 * with smooth transitions between forms.
 * 
 * @example
 * ```tsx
 * // In auth page
 * <AuthForms defaultTab="login" redirectTo="/dashboard" />
 * ```
 */
export function AuthForms({ defaultTab = 'login', redirectTo = '/dashboard' }: AuthFormsProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            AI Document Chat
          </h1>
          <p className="mt-2 text-gray-600">
            Chat with your documents using AI
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'login'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signup')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'signup'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Content */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {activeTab === 'login' ? (
            <LoginForm 
              redirectTo={redirectTo}
              onSwitchToSignup={() => setActiveTab('signup')}
            />
          ) : (
            <SignupForm 
              redirectTo={redirectTo}
              onSwitchToLogin={() => setActiveTab('login')}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
