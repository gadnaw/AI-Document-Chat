'use client'

import { useState, useCallback, useMemo } from 'react'

/**
 * Citation type matching API response format
 */
export interface Citation {
  documentId: string
  chunkId: string
  documentName: string
  pageNumber: number | null
  similarityScore: number
  preview: string
}

/**
 * Stream data format from Vercel AI SDK data channel
 */
interface StreamData {
  type: 'text' | 'citation'
  content: string
  documentId?: string
  chunkId?: string
  documentName?: string
  pageNumber?: number
  similarityScore?: number
  preview?: string
}

/**
 * useCitations hook result
 */
interface UseCitationsResult {
  citations: Citation[]
  addCitations: (data: StreamData[]) => void
  clearCitations: () => void
  isComplete: boolean
  citationCount: number
  uniqueDocuments: string[]
}

/**
 * useCitations hook
 * 
 * Extracts and manages citations from streaming data.
 * Handles real-time citation updates as responses stream in.
 * 
 * @example
 * ```tsx
 * const { citations, addCitations, clearCitations } = useCitations()
 * 
 * // In streaming response handler
 * addCitations(streamData)
 * ```
 */

export function useCitations(): UseCitationsResult {
  const [citations, setCitations] = useState<Citation[]>([])
  const [isComplete, setIsComplete] = useState(false)

  // Add new citations from stream data
  const addCitations = useCallback((data: StreamData[]) => {
    const newCitations: Citation[] = []

    data.forEach((item) => {
      if (item.type === 'citation' && item.documentId && item.chunkId) {
        // Check if citation already exists to avoid duplicates
        const exists = citations.some(
          (c) => c.chunkId === item.chunkId
        )

        if (!exists) {
          newCitations.push({
            documentId: item.documentId,
            chunkId: item.chunkId,
            documentName: item.documentName || 'Unknown Document',
            pageNumber: item.pageNumber ?? null,
            similarityScore: item.similarityScore ?? 0,
            preview: item.preview || '',
          })
        }
      }
    })

    if (newCitations.length > 0) {
      setCitations((prev) => [...prev, ...newCitations])
    }
  }, [citations])

  // Clear all citations
  const clearCitations = useCallback(() => {
    setCitations([])
    setIsComplete(false)
  }, [])

  // Mark streaming as complete
  const complete = useCallback(() => {
    setIsComplete(true)
  }, [])

  // Count of unique citations
  const citationCount = useMemo(() => {
    return citations.length
  }, [citations])

  // Unique document IDs referenced
  const uniqueDocuments = useMemo(() => {
    const docs = new Set(citations.map((c) => c.documentId))
    return Array.from(docs)
  }, [citations])

  return {
    citations,
    addCitations,
    clearCitations,
    isComplete,
    citationCount,
    uniqueDocuments,
  }
}

/**
 * Parse raw stream data into structured format
 * 
 * @param rawData - Raw data from stream (JSON string or object)
 * @returns Parsed StreamData array
 */
export function parseStreamData(rawData: unknown): StreamData[] {
  if (!rawData) return []

  try {
    if (typeof rawData === 'string') {
      return JSON.parse(rawData)
    }
    if (Array.isArray(rawData)) {
      return rawData
    }
    if (typeof rawData === 'object') {
      return [rawData as StreamData]
    }
  } catch (error) {
    console.error('Error parsing stream data:', error)
  }

  return []
}

/**
 * Format citation for display
 * 
 * @param citation - Citation object
 * @param index - Citation index for numbering
 * @returns Formatted citation string
 */
export function formatCitation(citation: Citation, index: number): string {
  const parts: string[] = [`[${index + 1}]`]
  
  if (citation.documentName) {
    parts.push(citation.documentName)
  }
  
  if (citation.pageNumber) {
    parts.push(`p.${citation.pageNumber}`)
  }
  
  const relevance = Math.round(citation.similarityScore * 100)
  parts.push(`(${relevance}% relevant)`)
  
  return parts.join(' ')
}

/**
 * Group citations by document
 * 
 * @param citations - Array of citations
 * @returns Object with document ID as key and citations array as value
 */
export function groupCitationsByDocument(citations: Citation[]): Record<string, Citation[]> {
  return citations.reduce((acc, citation) => {
    const docId = citation.documentId
    if (!acc[docId]) {
      acc[docId] = []
    }
    acc[docId].push(citation)
    return acc
  }, {} as Record<string, Citation[]>)
}
