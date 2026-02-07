'use client'

import { useState, useMemo } from 'react'
import type { Citation } from '@/lib/hooks/use-citations'

interface CitationPanelProps {
  conversationId: string | null
}

/**
 * CitationPanel Component
 * 
 * Side panel displaying all citations for the conversation with:
 * - Expandable citation cards
 * - Document navigation links
 * - Search and filter functionality
 * - Grouping by document
 * 
 * Features:
 * - Smooth expand/collapse animations
 * - Keyboard navigation
 * - Relevance filtering
 * - Quick copy functionality
 */

export function CitationPanel({ conversationId }: CitationPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [minRelevance, setMinRelevance] = useState(0)

  // Placeholder citations - in production, these would come from the conversation context
  const [citations] = useState<Citation[]>([])

  // Group citations by document
  const groupedCitations = useMemo(() => {
    const groups: Record<string, Citation[]> = {}
    
    citations.forEach((citation) => {
      if (!groups[citation.documentId]) {
        groups[citation.documentId] = []
      }
      groups[citation.documentId].push(citation)
    })
    
    return groups
  }, [citations])

  // Filter citations by search query and relevance
  const filteredGroups = useMemo(() => {
    const filtered: Record<string, Citation[]> = {}
    
    Object.entries(groupedCitations).forEach(([docId, docCitations]) => {
      const filteredCitations = docCitations.filter((citation) => {
        const matchesSearch = 
          citation.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          citation.preview.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesRelevance = citation.similarityScore >= minRelevance
        
        return matchesSearch && matchesRelevance
      })
      
      if (filteredCitations.length > 0) {
        filtered[docId] = filteredCitations
      }
    })
    
    return filtered
  }, [groupedCitations, searchQuery, minRelevance])

  // Toggle document expansion
  const toggleExpanded = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  // Calculate stats
  const totalCitations = citations.length
  const uniqueDocuments = Object.keys(groupedCitations).length
  const avgRelevance = citations.length > 0
    ? citations.reduce((sum, c) => sum + c.similarityScore, 0) / citations.length
    : 0

  return (
    <aside className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Citations</h2>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {totalCitations} citations
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {uniqueDocuments} documents
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search citations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Relevance filter */}
        <div className="mt-3">
          <label className="text-xs text-gray-500 mb-1 block">
            Min relevance: {Math.round(minRelevance * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={minRelevance}
            onChange={(e) => setMinRelevance(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Citations list */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(filteredGroups).length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-sm">
              {totalCitations === 0 
                ? 'No citations yet' 
                : 'No citations match your search'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {Object.entries(filteredGroups).map(([docId, docCitations]) => {
              const isExpanded = expandedDocs.has(docId)
              const avgDocRelevance = docCitations.reduce((sum, c) => sum + c.similarityScore, 0) / docCitations.length

              return (
                <div key={docId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Document header */}
                  <button
                    onClick={() => toggleExpanded(docId)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {docCitations[0]?.documentName || 'Unknown Document'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {docCitations.length} citation{docCitations.length !== 1 ? 's' : ''}
                          <span className="ml-2 text-blue-600">
                            {Math.round(avgDocRelevance * 100)}% avg relevance
                          </span>
                        </p>
                      </div>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Citations for this document */}
                  {isExpanded && (
                    <div className="bg-white divide-y divide-gray-100">
                      {docCitations.map((citation, index) => (
                        <CitationCard key={citation.chunkId} citation={citation} index={index} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export citations
        </button>
      </div>
    </aside>
  )
}

/**
 * Individual citation card
 */
function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = `[${index + 1}] ${citation.documentName}${citation.pageNumber ? `, page ${citation.pageNumber}` : ''}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleNavigate = () => {
    // Navigate to document - in production, this would open the document viewer
    console.log('Navigate to document:', citation.documentId)
  }

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-medium rounded">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {citation.documentName}
            </p>
            {citation.pageNumber && (
              <p className="text-xs text-gray-500">Page {citation.pageNumber}</p>
            )}
          </div>
        </div>
        
        <span className={`
          flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded
          ${citation.similarityScore >= 0.8 
            ? 'bg-green-100 text-green-700' 
            : citation.similarityScore >= 0.6
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'}
        `}>
          {Math.round(citation.similarityScore * 100)}%
        </span>
      </div>

      {/* Preview */}
      <p className="mt-2 text-xs text-gray-600 line-clamp-2">
        {citation.preview}
      </p>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy reference"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
          
          <button
            onClick={handleNavigate}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="View in document"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 p-3 bg-gray-100 rounded-lg">
          <p className="text-xs text-gray-700 leading-relaxed">
            {citation.preview}
          </p>
        </div>
      )}
    </div>
  )
}
