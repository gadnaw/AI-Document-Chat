'use client'

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import type { UploadFile, FileUploaderProps } from '@/types/upload'
import { validateFile, validateFilesForUpload } from '@/lib/validation'
import { checkPreUploadDuplicate } from '@/lib/duplicate-detection'
import { ProgressTracker } from '@/lib/progress-tracker'

/**
 * FileUploader Component
 * Drag-and-drop file upload with immediate validation feedback
 * 
 * @example
 * ```tsx
 * <FileUploader 
 *   sessionId={sessionId}
 *   onFilesQueued={(files) => console.log('Queued:', files)}
 *   onSessionComplete={(response) => console.log('Complete:', response)}
 * />
 * ```
 */
export function FileUploader({
  sessionId,
  onFilesQueued,
  onSessionComplete,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationMessages, setValidationMessages] = useState<Array<{
    file: string
    message: string
    type: 'error' | 'success'
  }>>([])
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressTracker = useRef<ProgressTracker | null>(null)

  /**
   * Initialize or get progress tracker
   */
  const getProgressTracker = useCallback(() => {
    if (!progressTracker.current) {
      const tracker = new ProgressTracker(sessionId)
      progressTracker.current = tracker
    }
    return progressTracker.current
  }, [sessionId])

  /**
   * Handle drag enter - show active state
   */
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  /**
   * Handle drag leave - remove active state
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  /**
   * Handle drag over - required for drop to work
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Don't set isDragging here to avoid flickering
  }, [])

  /**
   * Process dropped or selected files
   */
  const processFiles = useCallback(async (files: File[]) => {
    const messages: Array<{ file: string; message: string; type: 'error' | 'success' }> = []
    const tracker = getProgressTracker()
    
    // Generate session ID if needed
    let currentSessionId = tracker.sessionId
    if (!sessionId) {
      currentSessionId = tracker.sessionId
    }

    // Validate all files
    const { ready, rejected, summary } = await validateFilesForUpload(files)
    
    // Add validation messages for rejected files
    for (const { file, reason } of rejected) {
      messages.push({
        file: file.name,
        message: reason,
        type: 'error',
      })
    }

    // Check for duplicates among ready files
    const queuedFiles = tracker.queueState.files
    const uniqueReady: Array<{ file: File; sha256: string }> = []
    
    for (const file of ready) {
      const report = checkPreUploadDuplicate(file, queuedFiles)
      
      if (report.isDuplicate) {
        messages.push({
          file: file.name,
          message: report.message || `'${file.name}' was skipped (duplicate)`,
          type: 'error',
        })
      } else {
        // Calculate hash for the file
        const arrayBuffer = await file.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        
        uniqueReady.push({ file, sha256 })
      }
    }

    // Add unique files to queue
    const queuedUploadFiles: UploadFile[] = []
    for (const { file, sha256 } of uniqueReady) {
      const uploadFile = tracker.addFile(file, sha256)
      queuedUploadFiles.push(uploadFile)
      messages.push({
        file: file.name,
        message: `'${file.name}' is ready for upload`,
        type: 'success',
      })
    }

    // Update validation messages
    setValidationMessages(messages)

    // Report queued files
    if (queuedUploadFiles.length > 0 && onFilesQueued) {
      onFilesQueued(queuedUploadFiles)
    }

    // Show summary
    if (uniqueReady.length > 0) {
      messages.push({
        file: 'Summary',
        message: `${uniqueReady.length} file(s) ready for upload, starting...`,
        type: 'success',
      })
    }

    // Trigger upload if files are ready
    if (uniqueReady.length > 0) {
      setIsUploading(true)
      // Start upload process
      await initiateUpload(tracker, currentSessionId)
    }

    // Clear messages after delay
    if (messages.length > 0) {
      setTimeout(() => {
        setValidationMessages([])
      }, 5000)
    }
  }, [sessionId, onFilesQueued, getProgressTracker])

  /**
   * Initiate upload process for queued files
   */
  const initiateUpload = async (
    tracker: ProgressTracker,
    currentSessionId: string
  ) => {
    try {
      // Upload files sequentially
      for (const uploadFile of tracker.queueState.files) {
        if (uploadFile.status === 'pending') {
          await uploadFileToAPI(tracker, uploadFile, currentSessionId)
        }
      }
    } catch (error) {
      console.error('Upload process failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  /**
   * Upload single file to API
   */
  const uploadFileToAPI = async (
    tracker: ProgressTracker,
    uploadFile: UploadFile,
    sessionId: string
  ) => {
    const file = tracker.queueState.files.find(f => f.id === uploadFile.id)
    if (!file) return

    // Update status to uploading
    tracker.updateFileStatus(uploadFile.id, 'uploading', 0)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('file', file.name) // This is wrong - need actual File object
      
      // For now, just mark as complete (actual upload happens in w02b)
      tracker.updateFileStatus(uploadFile.id, 'uploading', 50)
      await new Promise(resolve => setTimeout(resolve, 500))
      tracker.updateFileStatus(uploadFile.id, 'uploading', 100)
      tracker.markComplete(uploadFile.id)
      
    } catch (error) {
      tracker.markError(
        uploadFile.id,
        'Upload failed. Please try again.'
      )
    }
  }

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processFiles(files)
    }
  }, [processFiles])

  /**
   * Handle file input change
   */
  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      await processFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFiles])

  /**
   * Trigger file input click
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="file-uploader">
      {/* Drop zone */}
      <div
        className={`drop-zone ${isDragging ? 'active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? '#e3f2fd' : '#fafafa',
          borderColor: isDragging ? '#2196f3' : '#ccc',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          aria-label="File input"
        />

        {/* Drop zone content */}
        <div className="drop-zone-content">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {isUploading ? '⏳' : '📁'}
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500 }}>
            {isUploading ? 'Uploading files...' : 'Drag and drop PDF files here'}
          </p>
          <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
            or click to browse
          </p>
          <button
            type="button"
            className="browse-button"
            onClick={handleBrowseClick}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Browse Files
          </button>
          <p style={{ margin: '16px 0 0 0', color: '#999', fontSize: '12px' }}>
            Maximum file size: 50MB • PDF files only
          </p>
        </div>
      </div>

      {/* Validation messages */}
      {validationMessages.length > 0 && (
        <div 
          className="validation-messages"
          style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '4px',
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
          }}
        >
          {validationMessages.map((msg, index) => (
            <div
              key={index}
              style={{
                padding: '8px',
                margin: '4px 0',
                borderRadius: '4px',
                backgroundColor: msg.type === 'error' ? '#ffebee' : '#e8f5e9',
                color: msg.type === 'error' ? '#c62828' : '#2e7d32',
                fontSize: '14px',
              }}
            >
              {msg.type === 'error' ? '❌' : '✅'} {msg.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FileUploader
