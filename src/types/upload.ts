/**
 * TypeScript interfaces for the upload pipeline
 * Used throughout: UI components, API routes, progress tracking
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Status of a file throughout the upload and processing pipeline
 */
export type FileStatus = 
  | 'pending'      // Waiting to be processed
  | 'uploading'     // Currently uploading to storage
  | 'parsing'       // Extracting text from PDF (placeholder for w02b)
  | 'chunking'      // Creating text chunks (placeholder for w02b)
  | 'embedding'     // Generating embeddings (placeholder for w02b)
  | 'complete'      // Successfully processed
  | 'error'         // Failed during processing
  | 'skipped'       // Skipped due to duplicate detection

/**
 * Individual file in the upload queue
 */
export interface UploadFile {
  /** Unique identifier for this file entry */
  id: string
  /** Original filename as uploaded by user */
  name: string
  /** File size in bytes */
  size: number
  /** Current status in the pipeline */
  status: FileStatus
  /** Progress percentage within current stage (0-100) */
  progress: number
  /** User-friendly error message if status is 'error' */
  error?: string
  /** SHA-256 hash for duplicate detection */
  sha256?: string
  /** Session this file belongs to */
  sessionId: string
  /** When this file was added to the queue */
  createdAt: Date
  /** When processing started (if applicable) */
  startedAt?: Date
  /** When processing completed (if applicable) */
  completedAt?: Date
}

/**
 * State of the entire upload queue
 */
export interface QueueState {
  /** All files in the queue */
  files: UploadFile[]
  /** Session identifier for this queue */
  sessionId: string
  /** Index of currently processing file (-1 if none) */
  currentIndex: number
  /** When the queue was first created */
  startedAt?: Date
  /** Whether this queue has been completed */
  isComplete?: boolean
}

/**
 * Response from progress polling endpoint
 */
export interface ProgressResponse {
  /** Session identifier */
  sessionId: string
  /** All files in the session */
  files: UploadFile[]
  /** Number of successfully completed files */
  completedCount: number
  /** Total number of files in session */
  totalCount: number
  /** Names of files that were skipped as duplicates */
  skippedFiles: string[]
  /** Name of file currently being processed (if any) */
  processingFile?: string
  /** Overall progress percentage */
  overallProgress: number
}

/**
 * Result of client-side file validation
 */
export interface ValidationResult {
  /** Whether the file passed all validation checks */
  valid: boolean
  /** User-friendly error message if validation failed */
  error?: string
  /** SHA-256 hash calculated during validation (for duplicate detection) */
  sha256?: string
}

/**
 * Result of duplicate detection check
 */
export interface DuplicateReport {
  /** Whether this file is a duplicate */
  isDuplicate: boolean
  /** Type of duplicate match found */
  reason?: 'name' | 'sha256' | 'both'
  /** Details of the original file if duplicate */
  duplicateOf?: {
    name: string
    id: string
  }
  /** Action taken: 'skip' per requirements */
  action: 'skip' | 'process'
  /** User-friendly message for the UI */
  message?: string
}

/**
 * Response from upload API endpoint
 */
export interface UploadAPIResponse {
  /** Whether the operation was successful */
  success: boolean
  /** ID of the uploaded file (if uploaded, not skipped) */
  fileId?: string
  /** Whether the file was skipped as a duplicate */
  skipped: boolean
  /** Details of the original file if skipped */
  duplicateOf?: {
    name: string
    id: string
  }
  /** Session identifier */
  sessionId: string
  /** User-friendly error message if applicable */
  error?: string
}

/**
 * Props for FileUploader component
 */
export interface FileUploaderProps {
  /** Session ID to associate uploads with */
  sessionId?: string
  /** Callback when files are queued for upload */
  onFilesQueued?: (files: UploadFile[]) => void
  /** Callback when upload session is complete */
  onSessionComplete?: (response: ProgressResponse) => void
  /** Maximum file size in bytes (default: 50MB) */
  maxFileSize?: number
  /** Accepted file types (default: PDF only) */
  acceptedTypes?: string[]
}

/**
 * Props for UploadQueue component
 */
export interface UploadQueueProps {
  /** Session ID to track progress for */
  sessionId: string
  /** Supabase client for API calls */
  supabase: SupabaseClient
  /** Callback when queue is cleared */
  onQueueClear?: () => void
  /** Whether to auto-start polling on mount */
  autoPoll?: boolean
  /** Polling interval in milliseconds (default: 1000) */
  pollInterval?: number
}

/**
 * File to be uploaded (browser File API)
 */
export interface FileToUpload {
  /** Browser File object */
  file: File
  /** Pre-calculated SHA-256 hash */
  sha256?: string
  /** Validation result */
  validation?: ValidationResult
}

/**
 * Error details for failed uploads
 */
export interface UploadError {
  /** File ID that failed */
  fileId: string
  /** User-friendly error message */
  message: string
  /** Technical error details (for debugging, not shown to users) */
  technicalDetails?: string
  /** Whether this error is retryable */
  retryable: boolean
}
