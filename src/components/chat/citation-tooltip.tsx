'use client'

import { useState, useRef, useEffect } from 'react'
import type { Citation } from '@/lib/hooks/use-citations'

interface CitationTooltipProps {
  citation: Citation
  index: number
  children: React.ReactNode
}

/**
 * CitationTooltip Component
 * 
 * Hoverable citation marker that displays:
 * - Document name
 * - Page number (if available)
 * - Relevance score
 * - Text preview from source
 * 
 * Features:
 * - Smooth fade-in animation
 * - Keyboard accessible
 * - Smart positioning to avoid viewport overflow
 * - Click to copy reference
 */

export function CitationTooltip({ citation, index, children }: CitationTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')
  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  // Handle mouse enter/leave
  const handleMouseEnter = () => setIsVisible(true)
  const handleMouseLeave = () => setIsVisible(false)

  // Handle focus/blur for keyboard accessibility
  const handleFocus = () => setIsVisible(true)
  const handleBlur = () => setIsVisible(false)

  // Check tooltip position on mount and resize
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    // Check if tooltip would overflow bottom
    if (triggerRect.bottom + tooltipRect.height + 10 > viewportHeight) {
      setPosition('bottom')
    } else {
      setPosition('top')
    }
  }, [isVisible])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false)
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isVisible])

  const handleClick = async () => {
    // Copy citation reference to clipboard
    const reference = formatCitationReference(citation, index)
    
    try {
      await navigator.clipboard.writeText(reference)
      // Could show a toast here for feedback
    } catch (error) {
      console.error('Failed to copy citation:', error)
    }
  }

  return (
    <span 
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Citation marker */}
      <button
        onClick={handleClick}
        className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors cursor-pointer"
        aria-label={`View citation ${index + 1}: ${citation.documentName}`}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {index + 1}
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`
            absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-xl
            animate-in fade-in zoom-in-95 duration-200
            ${position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2'}
          `}
          role="tooltip"
        >
          {/* Arrow */}
          <div className={`
            absolute w-3 h-3 bg-gray-900 transform rotate-45
            ${position === 'top' ? 'bottom-[-6px] left-1/2 -translate-x-1/2' : 'top-[-6px] left-1/2 -translate-x-1/2'}
          `} />

          {/* Content */}
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm leading-tight">
                {citation.documentName}
              </p>
              <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                #{index + 1}
              </span>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {citation.pageNumber && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Page {citation.pageNumber}
                </span>
              )}
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {Math.round(citation.similarityScore * 100)}% relevant
              </span>
            </div>

            {/* Preview */}
            {citation.preview && (
              <p className="text-xs text-gray-300 leading-relaxed border-t border-gray-700 pt-2">
                {citation.preview}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-700">
              <button
                onClick={handleClick}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy reference
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Children (the citation content) */}
      {children}
    </span>
  )
}

/**
 * Format citation as a reference string
 */
function formatCitationReference(citation: Citation, index: number): string {
  const parts: string[] = [`[${index + 1}]`]
  
  if (citation.documentName) {
    parts.push(citation.documentName)
  }
  
  if (citation.pageNumber) {
    parts.push(`page ${citation.pageNumber}`)
  }
  
  return parts.join(' ')
}
