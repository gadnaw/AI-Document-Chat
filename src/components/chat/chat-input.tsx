'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ChatInputProps {
  onSend: (content: string) => void
  isLoading: boolean
  disabled?: boolean
}

/**
 * ChatInput Component
 * 
 * Message composition area with:
 * - Auto-resizing text area
 * - Send button with loading state
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * - Character/word count
 * - Focus management
 */

export function ChatInput({ onSend, isLoading, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea height
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [message, adjustHeight])

  // Handle keyboard submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    const trimmed = message.trim()
    if (!trimmed || isLoading || disabled) return

    onSend(trimmed)
    setMessage('')
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Refocus for continuous conversation
    textareaRef.current?.focus()
  }

  const characterCount = message.length
  const wordCount = message.trim() ? message.trim().split(/\s+/).length : 0

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative">
        {/* Text input */}
        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            disabled={disabled || isLoading}
            rows={1}
            className="w-full px-4 py-3 resize-none outline-none text-gray-900 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />

          {/* Footer with character count and send button */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
            {/* Character/word count */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {characterCount > 0 && (
                <>
                  <span>{characterCount} chars</span>
                  <span>{wordCount} words</span>
                </>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || isLoading || disabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                message.trim() && !isLoading && !disabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send message"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono text-gray-500">Enter</kbd> to send
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono text-gray-500">Shift + Enter</kbd> for new line
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading spinner component
 */
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  }

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} text-current`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
