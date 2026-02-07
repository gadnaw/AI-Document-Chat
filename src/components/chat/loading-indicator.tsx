'use client'

import { useState, useEffect } from 'react'

interface LoadingIndicatorProps {
  isLoading: boolean
  message?: string
  type?: 'typing' | 'searching' | 'processing' | 'streaming'
}

/**
 * LoadingIndicator Component
 * 
 * Provides visual feedback during different loading states:
 * - typing: Assistant is generating a response
 * - searching: Retrieving relevant documents
 * - processing: Processing the request
 * - streaming: Streaming response back
 * 
 * Features:
 * - Animated feedback appropriate to the type
 * - Customizable message
 * - Progress estimation (when available)
 */

export function LoadingIndicator({ 
  isLoading, 
  message,
  type = 'typing' 
}: LoadingIndicatorProps) {
  if (!isLoading) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
      {getLoadingAnimation(type)}
      
      <div className="flex flex-col">
        <span className="text-sm text-gray-600">
          {message || getDefaultMessage(type)}
        </span>
        {type === 'searching' && <ProgressDots />}
      </div>
    </div>
  )
}

/**
 * Get appropriate animation based on loading type
 */
function getLoadingAnimation(type: LoadingIndicatorProps['type']) {
  switch (type) {
    case 'typing':
      return <TypingAnimation />
    case 'searching':
      return <SearchingAnimation />
    case 'processing':
      return <ProcessingAnimation />
    case 'streaming':
      return <StreamingAnimation />
    default:
      return <TypingAnimation />
  }
}

/**
 * Get default message based on loading type
 */
function getDefaultMessage(type: LoadingIndicatorProps['type']) {
  switch (type) {
    case 'typing':
      return 'Thinking...'
    case 'searching':
      return 'Finding relevant documents...'
    case 'processing':
      return 'Processing your request...'
    case 'streaming':
      return 'Generating response...'
    default:
      return 'Loading...'
  }
}

/**
 * Typing animation (three bouncing dots)
 */
function TypingAnimation() {
  return (
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/**
 * Searching animation (magnifying glass)
 */
function SearchingAnimation() {
  return (
    <svg className="w-5 h-5 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

/**
 * Processing animation (spinner)
 */
function ProcessingAnimation() {
  return (
    <svg className="w-5 h-5 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/**
 * Streaming animation (waveform)
 */
function StreamingAnimation() {
  return (
    <div className="flex items-center gap-0.5 h-4">
      <span className="w-1 bg-green-500 rounded animate-pulse" style={{ height: '40%', animationDelay: '0ms' }} />
      <span className="w-1 bg-green-500 rounded animate-pulse" style={{ height: '60%', animationDelay: '100ms' }} />
      <span className="w-1 bg-green-500 rounded animate-pulse" style={{ height: '80%', animationDelay: '200ms' }} />
      <span className="w-1 bg-green-500 rounded animate-pulse" style={{ height: '50%', animationDelay: '300ms' }} />
      <span className="w-1 bg-green-500 rounded animate-pulse" style={{ height: '70%', animationDelay: '400ms' }} />
    </div>
  )
}

/**
 * Progress dots for ongoing operations
 */
function ProgressDots() {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <span className="text-xs text-gray-400">
      {'.'.repeat(dots)}
    </span>
  )
}

/**
 * Rate limit warning component
 */
interface RateLimitWarningProps {
  remaining: number
  limit: number
  resetTime?: string
  onUpgrade?: () => void
}

export function RateLimitWarning({ 
  remaining, 
  limit, 
  resetTime,
  onUpgrade 
}: RateLimitWarningProps) {
  const percentage = (remaining / limit) * 100
  const isCritical = percentage <= 20
  const isWarning = percentage <= 50

  return (
    <div className={`px-4 py-3 rounded-lg border ${
      isCritical 
        ? 'bg-red-50 border-red-200' 
        : isWarning 
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-blue-50 border-blue-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
          isCritical ? 'bg-red-100' : isWarning ? 'bg-yellow-100' : 'bg-blue-100'
        }`}>
          <svg className={`w-4 h-4 ${
            isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-blue-600'
          }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="flex-1">
          <h4 className={`text-sm font-medium ${
            isCritical ? 'text-red-800' : isWarning ? 'text-yellow-800' : 'text-blue-800'
          }`}>
            {isCritical ? 'Rate limit almost reached' : isWarning ? 'Approaching rate limit' : 'Using rate-limited API'}
          </h4>
          
          <p className={`text-xs mt-1 ${
            isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-blue-600'
          }`}>
            {remaining} of {limit} messages remaining this hour
          </p>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {resetTime && (
            <p className={`text-xs mt-1 ${
              isCritical ? 'text-red-500' : 'text-gray-500'
            }`}>
              Resets at {resetTime}
            </p>
          )}
        </div>

        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex-shrink-0 px-3 py-1 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Error display component
 */
interface ErrorDisplayProps {
  error: string
  onRetry?: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
      <svg className="flex-shrink-0 w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>

      <div className="flex-1">
        <p className="text-sm text-red-700">{error}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex-shrink-0 px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}
