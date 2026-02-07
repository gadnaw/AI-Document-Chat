'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'

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
 * 
 * Note: Full functionality implemented in 04-w03 (Conversation Persistence)
 */

export function ChatSidebar({ onSelectConversation, onNewConversation }: ChatSidebarProps) {
  const { user, loading } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updated_at: string }>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelectConversation = (id: string) => {
    setSelectedId(id)
    onSelectConversation(id)
  }

  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
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
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
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

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewConversation}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Start your first chat
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-1 px-2">
            {filteredConversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedId === conversation.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <p className="font-medium text-sm truncate">{conversation.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(conversation.updated_at).toLocaleDateString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
