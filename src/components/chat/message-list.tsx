'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'

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

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  onCitationsUpdate: (hasCitations: boolean) => void
}

/**
 * MessageList Component
 * 
 * Scrollable message history with:
 * - Auto-scroll to bottom on new messages
 * - Streaming text animation for assistant responses
 * - Citation markers in message bubbles
 * - Loading state indicator
 */

export function MessageList({ messages, isLoading, onCitationsUpdate }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check for citations in messages
  useEffect(() => {
    const hasCitations = messages.some(msg => 
      msg.role === 'assistant' && msg.citations && msg.citations.length > 0
    )
    onCitationsUpdate(hasCitations)
  }, [messages, onCitationsUpdate])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isStreaming={isLoading && message.id === messages[messages.length - 1]?.id}
        />
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 px-4">
          <LoadingDots />
        </div>
      )}

      {/* Invisible element for auto-scroll */}
      <div ref={messagesEndRef} />
    </div>
  )
}

/**
 * Loading dots animation
 */
function LoadingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}
