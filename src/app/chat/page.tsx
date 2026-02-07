'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatArea } from '@/components/chat/chat-area'
import { CitationPanel } from '@/components/chat/citation-panel'
import { ErrorBoundary } from '@/components/error-boundary'
import { useConversation } from '@/lib/hooks/use-conversation'

/**
 * Chat Page
 * 
 * Main chat interface with:
 * - Sidebar: Conversation list navigation
 * - Main area: Chat messages and input
 * - Citation panel: Source document references (collapsible)
 * 
 * Responsive design with mobile sidebar toggle
 * URL-based conversation state for sharing and bookmarking (04-w03)
 */

export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showSidebar, setShowSidebar] = useState(true)
  const [showCitations, setShowCitations] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  
  const { createConversation } = useConversation()

  // Load conversation ID from URL on mount
  useEffect(() => {
    const urlConversationId = searchParams.get('conversation')
    if (urlConversationId) {
      setConversationId(urlConversationId)
    }
  }, [searchParams])

  // Handle conversation selection
  const handleSelectConversation = useCallback(async (id: string) => {
    setConversationId(id)
    
    // Update URL without full page reload
    const params = new URLSearchParams(searchParams.toString())
    params.set('conversation', id)
    router.push(`?${params.toString()}`, { scroll: false })
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) {
      setShowSidebar(false)
    }
  }, [router, searchParams])

  // Handle new conversation creation
  const handleNewConversation = useCallback(async () => {
    // Create new conversation
    const conversation = await createConversation('New Chat')
    
    if (conversation) {
      const newConversationId = conversation.id
      setConversationId(newConversationId)
      
      // Update URL
      const params = new URLSearchParams(searchParams.toString())
      params.set('conversation', newConversationId)
      router.push(`?${params.toString()}`, { scroll: false })
    }
  }, [createConversation, router, searchParams])

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-72 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
          lg:transform-none
        `}
      >
        <ChatSidebar
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
          
          <button
            onClick={() => setShowCitations(!showCitations)}
            className={`ml-auto p-2 rounded-lg transition-colors ${
              showCitations ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            aria-label="Toggle citations"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <h1 className="text-xl font-semibold text-gray-900">Chat</h1>
          </div>
          
          <button
            onClick={() => setShowCitations(!showCitations)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showCitations ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-medium">Citations</span>
          </button>
        </header>

        {/* Chat area with error boundary */}
        <div className="flex-1 flex overflow-hidden">
          <ErrorBoundary
            fallback={(error, reset) => (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chat Error</h3>
                  <p className="text-gray-600 mb-4">Something went wrong loading the chat.</p>
                  <button
                    onClick={reset}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <ChatArea
              conversationId={conversationId}
              onCitationsUpdate={(hasCitations) => {
                // Auto-show citations panel when response has citations
                if (hasCitations && !showCitations) {
                  // Optionally auto-show, or let user toggle
                }
              }}
            />
          </ErrorBoundary>

          {/* Citation panel */}
          {showCitations && (
            <CitationPanel conversationId={conversationId} />
          )}
        </div>
      </main>
    </div>
  )
}
