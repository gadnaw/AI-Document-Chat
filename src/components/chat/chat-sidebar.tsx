'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useConversation, Conversation } from '@/lib/hooks/use-conversation'

interface ChatSidebarProps {
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
}

/**
 * ChatSidebar Component
 * 
 * Conversation list sidebar with:
 * - New conversation button
 * - Conversation list with search
 * - Active conversation indicator
 * - Delete functionality
 * 
 * Full implementation with API integration (04-w03)
 */

export function ChatSidebar({ onSelectConversation, onNewConversation }: ChatSidebarProps) {
  const { user, loading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  
  const {
    conversations,
    loading,
    error,
    fetchConversations,
    createConversation,
    deleteConversation,
    currentConversation,
    loadConversation,
    isCreating,
    isDeleting,
  } = useConversation()

  // Load conversations on mount
  useEffect(() => {
    if (user && !authLoading) {
      fetchConversations()
    }
  }, [user, authLoading, fetchConversations])

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectConversation = useCallback(async (id: string) => {
    setSelectedId(id)
    
    // Load conversation if not already loaded
    if (currentConversation?.conversation.id !== id) {
      await loadConversation(id)
    }
    
    onSelectConversation(id)
  }, [currentConversation, loadConversation, onSelectConversation])

  const handleCreateConversation = useCallback(async () => {
    // Create a new conversation with auto-generated title
    const conversation = await createConversation('New Chat')
    
    if (conversation) {
      onNewConversation()
    }
  }, [createConversation, onNewConversation])

  const handleDeleteConversation = useCallback(async (id: string) => {
    const success = await deleteConversation(id)
    
    if (success && selectedId === id) {
      setSelectedId(null)
      onNewConversation()
    }
    
    setShowDeleteConfirm(null)
  }, [deleteConversation, selectedId, onNewConversation])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }

  if (authLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded-lg mb-4" />
          <div className="h-8 bg-gray-200 rounded mb-2" />
          <div className="h-8 bg-gray-200 rounded mb-2" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sign in required</h3>
          <p className="text-gray-600 text-sm">Please sign in to access your conversations.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleCreateConversation}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => fetchConversations()}
            className="mt-2 text-red-700 text-sm underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="px-4">
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateConversation}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Start your first chat
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-1 px-2">
            {filteredConversations.map((conversation) => (
              <li key={conversation.id} className="relative group">
                <button
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedId === conversation.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm truncate flex-1">{conversation.title}</p>
                    <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                      {formatDate(conversation.updated_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
                  </p>
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteConfirm(conversation.id)
                  }}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete conversation?</h3>
            <p className="text-gray-600 text-sm mb-4">
              This will permanently delete the conversation and all its messages. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(showDeleteConfirm)}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User info footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-medium text-sm">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.email || 'User'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

