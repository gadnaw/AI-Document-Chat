'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { UploadFile, UploadQueueProps, ProgressResponse, FileStatus } from '@/types/upload'

/**
 * UploadQueue Component
 * Multi-file queue display with real-time progress tracking and polling
 * 
 * @example
 * ```tsx
 * <UploadQueue 
 *   sessionId={sessionId}
 *   supabase={supabaseClient}
 *   autoPoll={true}
 *   pollInterval={1000}
 *   onQueueClear={() => console.log('Queue cleared')}
 * />
 * ```
 */
export function UploadQueue({
  sessionId,
  supabase,
  autoPoll = true,
  pollInterval = 1000,
  onQueueClear,
}: UploadQueueProps) {
  const [progress, setProgress] = useState<ProgressResponse | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch progress from API
   */
  const fetchProgress = useCallback(async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/progress/${sessionId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Session not found yet
          return
        }
        throw new Error('Failed to fetch progress')
      }

      const data = await response.json()
      setProgress(data)
      setError(null)
    } catch (err) {
      console.error('Progress fetch error:', err)
      setError('Failed to update progress')
    }
  }, [sessionId])

  /**
   * Start polling for progress updates
   */
  const startPolling = useCallback(() => {
    if (isPolling) return
    
    setIsPolling(true)
    fetchProgress() // Initial fetch
    
    const intervalId = setInterval(() => {
      fetchProgress()
    }, pollInterval)

    return () => {
      clearInterval(intervalId)
      setIsPolling(false)
    }
  }, [fetchProgress, pollInterval, isPolling])

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false)
  }, [])

  /**
   * Start polling when component mounts and sessionId is available
   */
  useEffect(() => {
    if (autoPoll && sessionId) {
      return startPolling()
    }
  }, [sessionId, autoPoll, startPolling])

  /**
   * Check if queue is complete
   */
  const isComplete = progress 
    ? progress.completedCount + progress.skippedFiles.length === progress.totalCount
    : false

  /**
   * Handle clear queue
   */
  const handleClearQueue = () => {
    stopPolling()
    setProgress(null)
    setError(null)
    if (onQueueClear) {
      onQueueClear()
    }
  }

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Get status icon for file status
   */
  const getStatusIcon = (status: FileStatus): ReactNode => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'uploading':
        return '📤'
      case 'parsing':
        return '📄'
      case 'chunking':
        return '✂️'
      case 'embedding':
        return '🔢'
      case 'complete':
        return '✅'
      case 'error':
        return '❌'
      case 'skipped':
        return '⏭️'
      default:
        return '📋'
    }
  }

  /**
   * Get status label for file status
   */
  const getStatusLabel = (status: FileStatus, progress: number): string => {
    switch (status) {
      case 'pending':
        return 'Waiting in queue'
      case 'uploading':
        return progress < 100 ? `Uploading... ${progress}%` : 'Upload complete'
      case 'parsing':
        return 'Extracting text...'
      case 'chunking':
        return 'Creating chunks...'
      case 'embedding':
        return 'Generating embeddings...'
      case 'complete':
        return 'Complete'
      case 'error':
        return 'Error'
      case 'skipped':
        return 'Skipped (duplicate)'
      default:
        return 'Unknown'
    }
  }

  /**
   * Get stage color for progress bar
   */
  const getStageColor = (status: FileStatus): string => {
    switch (status) {
      case 'pending':
        return '#9e9e9e'
      case 'uploading':
        return '#2196f3'
      case 'parsing':
        return '#ff9800'
      case 'chunking':
        return '#ff5722'
      case 'embedding':
        return '#9c27b0'
      case 'complete':
        return '#4caf50'
      case 'error':
        return '#f44336'
      case 'skipped':
        return '#607d8b'
      default:
        return '#9e9e9e'
    }
  }

  /**
   * Render progress bar
   */
  const renderProgressBar = (file: UploadFile) => {
    const color = getStageColor(file.status)
    
    return (
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            width: `${file.progress}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    )
  }

  /**
   * Render individual file item
   */
  const renderFileItem = (file: UploadFile, index: number) => {
    const isProcessing = progress?.processingFile === file.name &&
      (file.status === 'uploading' || file.status === 'parsing' || 
       file.status === 'chunking' || file.status === 'embedding')

    return (
      <div
        key={file.id}
        className={`file-item ${isProcessing ? 'processing' : ''}`}
        style={{
          padding: '16px',
          margin: '8px 0',
          backgroundColor: isProcessing ? '#e3f2fd' : '#fff',
          border: isProcessing ? '2px solid #2196f3' : '1px solid #e0e0e0',
          borderRadius: '8px',
          transition: 'all 0.2s ease',
        }}
      >
        {/* File info row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Status icon */}
          <div style={{ fontSize: '24px' }}>
            {getStatusIcon(file.status)}
          </div>

          {/* File details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '4px',
            }}>
              <span
                style={{
                  fontWeight: 500,
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={file.name}
              >
                {file.name}
              </span>
              <span style={{ color: '#666', fontSize: '12px' }}>
                {formatFileSize(file.size)}
              </span>
            </div>

            {/* Progress bar */}
            {renderProgressBar(file)}

            {/* Status label */}
            <div style={{ 
              marginTop: '4px',
              fontSize: '12px',
              color: getStageColor(file.status),
            }}>
              {getStatusLabel(file.status, file.progress)}
            </div>

            {/* Error message */}
            {file.status === 'error' && file.error && (
              <div style={{ 
                marginTop: '4px',
                fontSize: '12px',
                color: '#f44336',
              }}>
                {file.error}
              </div>
            )}
          </div>

          {/* Processing indicator */}
          {isProcessing && (
            <div style={{ 
              padding: '4px 8px',
              backgroundColor: '#2196f3',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}>
              Processing
            </div>
          )}
        </div>
      </div>
    )
  }

  /**
   * Render queue header
   */
  const renderQueueHeader = () => {
    if (!progress || progress.files.length === 0) {
      return null
    }

    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        padding: '0 4px',
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          Upload Queue
          {progress.totalCount > 0 && (
            <span style={{ 
              marginLeft: '8px',
              padding: '2px 8px',
              backgroundColor: '#e0e0e0',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
            }}>
              {progress.completedCount + progress.skippedFiles.length}/{progress.totalCount}
            </span>
          )}
        </h3>

        {isPolling && (
          <div style={{ fontSize: '12px', color: '#666' }}>
            🔄 Updating...
          </div>
        )}
      </div>
    )
  }

  /**
   * Render completion summary
   */
  const renderCompletionSummary = () => {
    if (!isComplete || !progress) return null

    return (
      <div
        className="completion-summary"
        style={{
          padding: '16px',
          marginTop: '16px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #4caf50',
          borderRadius: '8px',
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          marginBottom: progress.skippedFiles.length > 0 ? '8px' : 0,
        }}>
          <span style={{ fontSize: '24px' }}>🎉</span>
          <span style={{ fontWeight: 600, color: '#2e7d32' }}>
            Upload complete!
          </span>
        </div>

        {/* Completion stats */}
        <div style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
          {progress.completedCount} file(s) uploaded successfully
        </div>

        {/* Skipped duplicates summary */}
        {progress.skippedFiles.length > 0 && (
          <div style={{ 
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#fff',
            borderRadius: '4px',
            fontSize: '14px',
            color: '#666',
          }}>
            ⏭️ Skipped {progress.skippedFiles.length} duplicate file(s): {progress.skippedFiles.join(', ')}
          </div>
        )}

        {/* Clear queue button */}
        <button
          onClick={handleClearQueue}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Clear Queue
        </button>
      </div>
    )
  }

  /**
   * Render error state
   */
  const renderError = () => {
    if (!error) return null

    return (
      <div
        className="error-message"
        style={{
          padding: '12px',
          marginTop: '16px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          color: '#c62828',
          fontSize: '14px',
        }}
      >
        ⚠️ {error}
      </div>
    )
  }

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (progress?.files && progress.files.length > 0) return null

    return (
      <div
        className="empty-state"
        style={{
          padding: '40px',
          textAlign: 'center',
          color: '#999',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <p style={{ margin: 0, fontSize: '14px' }}>
          No files in queue. Drag and drop PDF files to start uploading.
        </p>
      </div>
    )
  }

  /**
   * Render overall progress
   */
  const renderOverallProgress = () => {
    if (!progress || progress.files.length === 0) return null

    return (
      <div
        className="overall-progress"
        style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            Overall Progress
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {progress.overallProgress}%
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '12px',
            backgroundColor: '#e0e0e0',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress.overallProgress}%`,
              height: '100%',
              backgroundColor: progress.overallProgress === 100 ? '#4caf50' : '#2196f3',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="upload-queue" style={{ padding: '16px' }}>
      {renderQueueHeader()}
      {renderOverallProgress()}
      {renderError()}
      
      {/* File list */}
      {progress?.files && progress.files.length > 0 ? (
        <div className="file-list">
          {progress.files.map((file, index) => 
            renderFileItem(file as UploadFile, index)
          )}
        </div>
      ) : (
        renderEmptyState()
      )}

      {/* Completion summary */}
      {renderCompletionSummary()}
    </div>
  )
}

export default UploadQueue
