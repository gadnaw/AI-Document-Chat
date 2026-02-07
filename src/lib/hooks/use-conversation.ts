'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * Conversation type matching API response
 */
export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

/**
 * Message type matching API response
 */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sourceChunks?: Array<{
    documentId: string
    chunkId: string
    documentName: string
    pageNumber: number | null
    similarityScore: number
    preview: string
  }>
  tokenCount?: number
  createdAt: string
  citations?: Array<{
    id: string
    documentId: string
    chunkId: string
    pageNumber: number | null
    highlightedText: string
  }>
}

/**
 * Conversation with messages
 */
export interface ConversationWithMessages {
  conversation: Conversation
  messages: Message[]
}

/**
 * useConversation hook result
 */
export interface UseConversationResult {
  // Conversations list
  conversations: Conversation[]
  loading: boolean
  error: string | null
  fetchConversations: (options?: { limit?: number; offset?: number }) => Promise<void>
  createConversation: (title: string) => Promise<Conversation | null>
  deleteConversation: (id: string) => Promise<boolean>
  updateTitle: (id: string, title: string) => Promise<boolean>
  
  // Single conversation
  currentConversation: ConversationWithMessages | null
  loadConversation: (id: string) => Promise<boolean>
  clearCurrentConversation: () => void
  
  // UI state
  isCreating: boolean
  isDeleting: boolean
}

/**
 * API helper for conversation endpoints
 */
async function conversationFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

/**
 * useConversation hook
 * 
 * Manages conversation CRUD operations and state for the chat UI.
 * Provides conversation list, current conversation loading, and mutations.
 * 
 * @example
 * ```tsx
 * const { 
 *   conversations, 
 *   fetchConversations, 
 *   createConversation,
 *   currentConversation,
 *   loadConversation 
 * } = useConversation()
 * 
 * // Load conversations on mount
 * useEffect(() => {
 *   fetchConversations()
 * }, [])
 * ```
 */
export function useConversation(): UseConversationResult {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<ConversationWithMessages | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch conversations list
  const fetchConversations = useCallback(async (options?: { limit?: number; offset?: number }) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.offset) params.set('offset', String(options.offset))

      const { conversations } = await conversationFetch<{ conversations: Conversation[] }>(
        `/api/conversations?${params.toString()}`
      )

      setConversations(conversations)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch conversations'
      setError(message)
      console.error('[useConversation] Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Create new conversation
  const createConversation = useCallback(async (title: string): Promise<Conversation | null> => {
    try {
      setIsCreating(true)
      setError(null)

      const { conversation } = await conversationFetch<{ conversation: Conversation }>(
        '/api/conversations',
        {
          method: 'POST',
          body: JSON.stringify({ title }),
        }
      )

      // Add to local state
      setConversations(prev => [conversation, ...prev])

      return conversation
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create conversation'
      setError(message)
      console.error('[useConversation] Error creating conversation:', err)
      return null
    } finally {
      setIsCreating(false)
    }
  }, [])

  // Delete conversation
  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsDeleting(true)
      setError(null)

      await conversationFetch(
        `/api/conversations/${id}`,
        { method: 'DELETE' }
      )

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== id))

      // Clear current conversation if it's the deleted one
      if (currentConversation?.conversation.id === id) {
        setCurrentConversation(null)
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(message)
      console.error('[useConversation] Error deleting conversation:', err)
      return false
    } finally {
      setIsDeleting(false)
    }
  }, [currentConversation])

  // Update conversation title
  const updateTitle = useCallback(async (id: string, title: string): Promise<boolean> => {
    try {
      setError(null)

      const { conversation } = await conversationFetch<{ conversation: Conversation }>(
        `/api/conversations/${id}/title`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        }
      )

      // Update local state
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title: conversation.title } : c)
      )

      // Update current conversation if it's the same one
      if (currentConversation?.conversation.id === id) {
        setCurrentConversation(prev => prev ? {
          ...prev,
          conversation: { ...prev.conversation, title: conversation.title }
        } : null)
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update title'
      setError(message)
      console.error('[useConversation] Error updating title:', err)
      return false
    }
  }, [currentConversation])

  // Load single conversation with messages
  const loadConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      const data = await conversationFetch<ConversationWithMessages>(
        `/api/conversations/${id}`
      )

      setCurrentConversation(data)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversation'
      setError(message)
      console.error('[useConversation] Error loading conversation:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Clear current conversation
  const clearCurrentConversation = useCallback(() => {
    setCurrentConversation(null)
  }, [])

  return {
    conversations,
    loading,
    error,
    fetchConversations,
    createConversation,
    deleteConversation,
    updateTitle,
    currentConversation,
    loadConversation,
    clearCurrentConversation,
    isCreating,
    isDeleting,
  }
}

/**
 * Create a new conversation and return its ID
 * Helper function for quick conversation creation
 */
export async function startNewConversation(): Promise<string | null> {
  try {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    })

    if (!response.ok) {
      throw new Error('Failed to create conversation')
    }

    const { conversation } = await response.json()
    return conversation.id
  } catch (error) {
    console.error('[useConversation] Error starting new conversation:', error)
    return null
  }
}
