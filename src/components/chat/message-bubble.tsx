'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  timestamp: string
}

interface Citation {
  documentId: string
  chunkId: string
  documentName: string
  pageNumber: number | null
  similarityScore: number
  preview: string
}

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

/**
 * MessageBubble Component
 * 
 * Individual message display with:
 * - Role-based styling (user vs assistant)
 * - Streaming text animation
 * - Citation markers with tooltips
 * - Timestamp display
 */

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const [displayedContent, setDisplayedContent] = useState(message.content)
  const [isAnimating, setIsAnimating] = useState(isStreaming && message.role === 'assistant')
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  // Streaming text animation
  useEffect(() => {
    if (!isStreaming || message.role !== 'assistant') {
      setIsAnimating(false)
      return
    }

    const targetContent = message.content
    let currentIndex = 0

    // Clear any existing animation
    if (animationRef.current) {
      clearTimeout(animationRef.current)
    }

    const animate = () => {
      if (currentIndex < targetContent.length) {
        // Add a few characters at a time for smoother animation
        const chunkSize = Math.random() > 0.5 ? 2 : 1
        currentIndex = Math.min(currentIndex + chunkSize, targetContent.length)
        setDisplayedContent(targetContent.substring(0, currentIndex))
        
        // Random delay between chunks for more natural feel
        const delay = Math.random() > 0.7 ? 30 : 15
        animationRef.current = setTimeout(animate, delay)
      } else {
        setIsAnimating(false)
      }
    }

    // Start with empty content for streaming effect
    setDisplayedContent('')
    animationRef.current = setTimeout(animate, 50)

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [message.content, isStreaming, message.role])

  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100' : 'bg-green-100'
      }`}>
        {isUser ? (
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Message bubble */}
        <div className={`px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-blue-600 text-white rounded-tr-sm' 
            : 'bg-white border border-gray-200 rounded-tl-sm'
        }`}>
          {/* Citations inline if present */}
          {message.citations && message.citations.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {message.citations.map((citation, index) => (
                <CitationMarker key={citation.chunkId} citation={citation} index={index} />
              ))}
            </div>
          )}

          {/* Message text with streaming effect */}
          <div className={`whitespace-pre-wrap ${isAnimating ? 'animate-pulse' : ''}`}>
            {displayedContent}
            {isAnimating && (
              <span className="inline-block w-1 h-4 ml-1 bg-gray-400 animate-pulse" />
            )}
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-400 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

/**
 * Citation marker component
 */
function CitationMarker({ citation, index }: { citation: Citation; index: number }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <span 
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        aria-label={`View citation ${index + 1}`}
      >
        {index + 1}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-10">
          <p className="font-medium mb-1">{citation.documentName}</p>
          {citation.pageNumber && (
            <p className="text-xs text-gray-400 mb-1">Page {citation.pageNumber}</p>
          )}
          <p className="text-xs text-gray-300 line-clamp-3">{citation.preview}</p>
          <p className="text-xs text-blue-300 mt-1">
            Relevance: {Math.round(citation.similarityScore * 100)}%
          </p>
        </div>
      )}
    </span>
  )
}
