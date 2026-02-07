/**
 * Progress tracking state management for upload queue
 * Handles session persistence, file status updates, and polling data preparation
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  UploadFile,
  QueueState,
  ProgressResponse,
  FileStatus,
} from '@/types/upload'

/**
 * Storage key prefix for upload sessions
 */
const STORAGE_PREFIX = 'upload_session_'

/**
 * ProgressTracker class for managing upload queue state
 */
export class ProgressTracker {
  private state: QueueState
  private supabaseClient?: ReturnType<typeof import('@supabase/supabase-js').createClient>

  /**
   * Create a new progress tracker
   * 
   * @param sessionId - Session ID for this upload queue
   * @param supabaseClient - Optional Supabase client for server-side operations
   */
  constructor(
    sessionId?: string,
    supabaseClient?: ReturnType<typeof import('@supabase/supabase-js').createClient>
  ) {
    this.state = {
      files: [],
      sessionId: sessionId || this.generateSessionId(),
      currentIndex: -1,
      startedAt: undefined,
      isComplete: false,
    }
    this.supabaseClient = supabaseClient

    // Try to restore from localStorage
    if (sessionId) {
      const restored = this.restoreFromStorage(sessionId)
      if (restored) {
        this.state = restored
      }
    }
  }

  /**
   * Get current session ID
   */
  get sessionId(): string {
    return this.state.sessionId
  }

  /**
   * Get current queue state
   */
  get queueState(): QueueState {
    return { ...this.state }
  }

  /**
   * Generate a new UUID v4 session ID
   */
  generateSessionId(): string {
    return uuidv4()
  }

  /**
   * Add a file to the upload queue
   * 
   * @param file - Browser File object
   * @param sha256 - Pre-calculated SHA-256 hash
   * @returns UploadFile entry created
   */
  addFile(file: File, sha256: string): UploadFile {
    const uploadFile: UploadFile = {
      id: uuidv4(),
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      sha256,
      sessionId: this.state.sessionId,
      createdAt: new Date(),
    }

    this.state.files.push(uploadFile)
    this.persistToStorage()
    return uploadFile
  }

  /**
   * Remove a file from the queue by ID
   * 
   * @param fileId - ID of file to remove
   * @returns true if file was found and removed
   */
  removeFile(fileId: string): boolean {
    const index = this.state.files.findIndex((f) => f.id === fileId)
    if (index === -1) {
      return false
    }

    this.state.files.splice(index, 1)
    
    // Adjust currentIndex if needed
    if (index <= this.state.currentIndex && this.state.currentIndex > 0) {
      this.state.currentIndex--
    }

    this.persistToStorage()
    return true
  }

  /**
   * Update file status and optional progress
   * 
   * @param fileId - ID of file to update
   * @param status - New status
   * @param progress - Optional-100)
   progress percentage (0 */
  updateFileStatus(
    fileId: string,
    status: FileStatus,
    progress?: number
  ): void {
    const file = this.state.files.find((f) => f.id === fileId)
    if (!file) {
      console.warn(`File not found: ${fileId}`)
      return
    }

    file.status = status
    if (progress !== undefined) {
      file.progress = Math.max(0, Math.min(100, progress))
    }

    // Track timing
    if (status === 'uploading' && !file.startedAt) {
      file.startedAt = new Date()
    }
    if (status === 'complete' || status === 'error' || status === 'skipped') {
      file.completedAt = new Date()
    }

    this.persistToStorage()
  }

  /**
   * Update progress percentage for a file
   * 
   * @param fileId - ID of file
   * @param progress - Progress percentage (0-100)
   */
  updateProgress(fileId: string, progress: number): void {
    const file = this.state.files.find((f) => f.id === fileId)
    if (!file) {
      return
    }

    file.progress = Math.max(0, Math.min(100, progress))
    this.persistToStorage()
  }

  /**
   * Mark a file as complete
   * 
   * @param fileId - ID of file
   */
  markComplete(fileId: string): void {
    this.updateFileStatus(fileId, 'complete', 100)
  }

  /**
   * Mark a file as errored
   * 
   * @param fileId - ID of file
   * @param errorMessage - User-friendly error message
   */
  markError(fileId: string, errorMessage: string): void {
    this.updateFileStatus(fileId, 'error')
    const file = this.state.files.find((f) => f.id === fileId)
    if (file) {
      file.error = errorMessage
    }
    this.persistToStorage()
  }

  /**
   * Mark a file as skipped (duplicate)
   * 
   * @param fileId - ID of file
   * @param duplicateOf - Name of original file if applicable
   */
  markSkipped(fileId: string, duplicateOf?: string): void {
    this.updateFileStatus(fileId, 'skipped')
    const file = this.state.files.find((f) => f.id === fileId)
    if (file) {
      file.error = duplicateOf
        ? `Skipped (duplicate of ${duplicateOf})`
        : 'Skipped (duplicate)'
    }
    this.persistToStorage()
  }

  /**
   * Get the next file in sequential processing order
   * 
   * @returns Next file to process, or null if queue is empty or complete
   */
  getNextFile(): UploadFile | null {
    // Find first pending file after current index
    for (let i = this.state.currentIndex + 1; i < this.state.files.length; i++) {
      if (this.state.files[i].status === 'pending') {
        return this.state.files[i]
      }
    }
    return null
  }

  /**
   * Get the currently processing file
   * 
   * @returns Currently processing file, or null if none
   */
  getProcessingFile(): UploadFile | null {
    if (this.state.currentIndex >= 0 && this.state.currentIndex < this.state.files.length) {
      const file = this.state.files[this.state.currentIndex]
      if (file.status === 'uploading' || file.status === 'parsing' || 
          file.status === 'chunking' || file.status === 'embedding') {
        return file
      }
    }
    return null
  }

  /**
   * Get all completed files
   * 
   * @returns Array of completed files
   */
  getCompletedFiles(): UploadFile[] {
    return this.state.files.filter((f) => f.status === 'complete')
  }

  /**
   * Get all skipped files
   * 
   * @returns Array of skipped files
   */
  getSkippedFiles(): UploadFile[] {
    return this.state.files.filter((f) => f.status === 'skipped')
  }

  /**
   * Get all errored files
   * 
   * @returns Array of errored files
   */
  getErrorFiles(): UploadFile[] {
    return this.state.files.filter((f) => f.status === 'error')
  }

  /**
   * Get overall progress statistics
   * 
   * @returns Object with completed count, total count, and percentage
   */
  getOverallProgress(): { completed: number; total: number; percent: number } {
    const completed = this.state.files.filter(
      (f) => f.status === 'complete' || f.status === 'skipped'
    ).length
    const total = this.state.files.length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    return { completed, total, percent }
  }

  /**
   * Check if all files have finished processing
   * 
   * @returns true if queue is complete
   */
  isQueueComplete(): boolean {
    return this.state.files.every(
      (f) =>
        f.status === 'complete' ||
        f.status === 'error' ||
        f.status === 'skipped'
    )
  }

  /**
   * Prepare progress response for API polling
   * 
   * @returns ProgressResponse object for client polling
   */
  prepareProgressResponse(): ProgressResponse {
    const processingFile = this.getProcessingFile()
    const skippedFiles = this.getSkippedFiles().map((f) => f.name)
    const { completed, total, percent } = this.getOverallProgress()

    return {
      sessionId: this.state.sessionId,
      files: this.state.files.map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status,
        progress: f.progress,
        error: f.error,
        sha256: f.sha256,
      })),
      completedCount: this.getCompletedFiles().length,
      totalCount: this.state.files.length,
      skippedFiles,
      processingFile: processingFile?.name,
      overallProgress: percent,
    }
  }

  /**
   * Format progress for API response
   */
  formatForAPI(): Omit<ProgressResponse, 'overallProgress'> {
    const processingFile = this.getProcessingFile()
    const skippedFiles = this.getSkippedFiles().map((f) => f.name)

    return {
      sessionId: this.state.sessionId,
      files: this.state.files.map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status,
        progress: f.progress,
        error: f.error,
        sha256: f.sha256,
      })),
      completedCount: this.getCompletedFiles().length,
      totalCount: this.state.files.length,
      skippedFiles,
      processingFile: processingFile?.name,
    }
  }

  /**
   * Merge server status into local state
   * 
   * @param serverFiles - File statuses from server
   */
  mergeServerStatus(serverFiles: Array<{
    id: string
    status: FileStatus
    progress: number
    error?: string
  }>): void {
    for (const serverFile of serverFiles) {
      const localFile = this.state.files.find((f) => f.id === serverFile.id)
      if (localFile) {
        localFile.status = serverFile.status
        localFile.progress = serverFile.progress
        if (serverFile.error) {
          localFile.error = serverFile.error
        }
      }
    }
    this.persistToStorage()
  }

  /**
   * Persist current state to localStorage
   */
  persistToStorage(): void {
    if (typeof window === 'undefined') {
      return // Don't persist on server
    }

    try {
      const key = STORAGE_PREFIX + this.state.sessionId
      localStorage.setItem(key, JSON.stringify(this.state))
    } catch (error) {
      console.warn('Failed to persist upload state:', error)
    }
  }

  /**
   * Restore state from localStorage
   * 
   * @param sessionId - Session ID to restore
   * @returns Restored QueueState or null if not found
   */
  restoreFromStorage(sessionId: string): QueueState | null {
    if (typeof window === 'undefined') {
      return null // Can't access localStorage on server
    }

    try {
      const key = STORAGE_PREFIX + sessionId
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...parsed,
          startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
          files: parsed.files.map((f: UploadFile) => ({
            ...f,
            createdAt: new Date(f.createdAt),
            startedAt: f.startedAt ? new Date(f.startedAt) : undefined,
            completedAt: f.completedAt ? new Date(f.completedAt) : undefined,
          })),
        }
      }
    } catch (error) {
      console.warn('Failed to restore upload state:', error)
    }

    return null
  }

  /**
   * Clear session from localStorage
   */
  clearSession(): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const key = STORAGE_PREFIX + this.state.sessionId
      localStorage.removeItem(key)
      this.state = {
        files: [],
        sessionId: this.state.sessionId,
        currentIndex: -1,
        startedAt: undefined,
        isComplete: false,
      }
    } catch (error) {
      console.warn('Failed to clear upload state:', error)
    }
  }

  /**
   * Start processing the queue
   */
  startProcessing(): void {
    if (!this.state.startedAt) {
      this.state.startedAt = new Date()
    }
    this.persistToStorage()
  }

  /**
   * Get summary of queue status
   */
  getSummary(): string {
    const { completed, total } = this.getOverallProgress()
    const skipped = this.getSkippedFiles().length
    const errors = this.getErrorFiles().length

    let summary = `${completed}/${total} files processed`
    if (skipped > 0) {
      summary += ` (${skipped} skipped)`
    }
    if (errors > 0) {
      summary += ` (${errors} errors)`
    }

    return summary
  }
}

/**
 * Create a new progress tracker with optional session restoration
 * 
 * @param sessionId - Optional session ID to restore
 * @returns ProgressTracker instance
 */
export function createProgressTracker(
  sessionId?: string
): ProgressTracker {
  return new ProgressTracker(sessionId)
}

/**
 * Clear a specific session from localStorage
 * 
 * @param sessionId - Session ID to clear
 */
export function clearUploadSession(sessionId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = STORAGE_PREFIX + sessionId
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to clear upload session:', error)
  }
}

/**
 * Get all stored session IDs
 * 
 * @returns Array of stored session IDs
 */
export function getStoredSessionIds(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  const prefixLength = STORAGE_PREFIX.length
  const ids: string[] = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const id = key.substring(prefixLength)
        ids.push(id)
      }
    }
  } catch (error) {
    console.warn('Failed to enumerate sessions:', error)
  }

  return ids
}
