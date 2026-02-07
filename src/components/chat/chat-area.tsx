'use client'

import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { useState } from 'react'

interface ChatAreaProps {
  conversationId: string | null
  onCitationsUpdate: (hasCitations: boolean) => void
}

/**
 * ChatArea Component
 * 
 * Main chat interface wrapper containing:
 * - MessageList: Scrollable message history
 * - ChatInput: Message composition area
 * 
 * Manages message state and handles message sending
 */

export function ChatArea({ conversationId, onCitationsUpdate }: ChatAreaProps) {
  const [messages, setMessages] = useState<Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    citations?: Array<{
      documentId: string
      chunkId: string
      documentName: string
      pageNumber: number | null
      similarityScore: number
      preview: string
    }>
    timestamp: string
  }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    // Add user message immediately
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          conversationId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      // For streaming response, we'll handle this in MessageList
      // For now, create a placeholder assistant message
      // Full streaming implementation in Task 2
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: 'This is a placeholder response. Full streaming implementation in Task 2.',
        citations: [],
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMessage])
      onCitationsUpdate(false)

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        timestamp: new Date().toISOString(),
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-md">
              <div className="mb-6">
                <svg className="mx-auto h-16 w-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Start a conversation</h2>
              <p className="text-gray-600">
                Upload documents and ask questions to get AI-powered answers with source citations.
              </p>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onCitationsUpdate={onCitationsUpdate}
          />
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <ChatInput
          onSend={handleSendMessage}
          isLoading={isLoading}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}
