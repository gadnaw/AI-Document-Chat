'use client'

import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import { useState, useCallback, useEffect } from 'react'
import { useConversation, Message } from '@/lib/hooks/use-conversation'

interface ChatAreaProps {
  conversationId: string | null
  onCitationsUpdate: (hasCitations: boolean) => void
}

/**
 * Message state type matching UI requirements
 */
interface UIMessage {
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
}

/**
 * ChatArea Component
 * 
 * Main chat interface wrapper containing:
 * - MessageList: Scrollable message history
 * - ChatInput: Message composition area
 * 
 * Manages message state, handles conversation switching, and message sending
 * with proper streaming support (04-w03)
 */

export function ChatArea({ conversationId, onCitationsUpdate }: ChatAreaProps) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const { 
    currentConversation, 
    loadConversation, 
    clearCurrentConversation,
    loading: conversationLoading,
  } = useConversation()

  // Load conversation messages when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId)
    } else {
      // New conversation - clear messages
      clearCurrentConversation()
      setMessages([])
    }
  }, [conversationId, loadConversation, clearCurrentConversation])

  // Sync loaded conversation messages to UI
  useEffect(() => {
    if (currentConversation?.messages) {
      const uiMessages: UIMessage[] = currentConversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        citations: msg.citations?.map(cit => ({
          documentId: cit.documentId,
          chunkId: cit.chunkId,
          documentName: cit.sourceChunks?.[0]?.documentName || 'Unknown',
          pageNumber: cit.pageNumber,
          similarityScore: cit.sourceChunks?.[0]?.similarityScore || 0,
          preview: cit.highlightedText || cit.sourceChunks?.[0]?.preview || '',
        })),
        timestamp: msg.createdAt,
      }))
      
      setMessages(uiMessages)
    }
  }, [currentConversation])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    // Add user message immediately
    const userMessageId = `user-${Date.now()}`
    const userMessage: UIMessage = {
      id: userMessageId,
      role: 'user',
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

      // Handle streaming response
      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''
        let assistantMessageId = `assistant-${Date.now()}`
        
        // Create placeholder assistant message
        const assistantMessage: UIMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        }
        
        setMessages(prev => [...prev, assistantMessage])
        
        // Process stream
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          assistantContent += chunk
          
          // Update assistant message with accumulated content
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: assistantContent }
                : msg
            )
          )
        }
        
        // Check for citations in final message
        // (In real implementation, citations would be extracted from stream data)
        onCitationsUpdate(false)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message
      const errorMessage: UIMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        timestamp: new Date().toISOString(),
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading, onCitationsUpdate])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {conversationLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-md">
              <div className="mb-6">
                <svg className="mx-auto h-16 w-16 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {conversationId ? 'Loading conversation...' : 'Start a conversation'}
              </h2>
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
          disabled={conversationLoading}
        />
      </div>
    </div>
  )
}
