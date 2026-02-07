'use client'

import { createBrowserClient } from '@/lib/supabase/client'
import { StorageError } from '@/lib/errors'

/**
 * Result of a document upload operation
 */
export interface UploadResult {
  /** Path where the file is stored */
  path: string
  /** Original filename */
  filename: string
  /** File size in bytes */
  size: number
  /** MIME type */
  mimeType: string
}

/**
 * Document file metadata
 */
export interface DocumentFile {
  /** File name */
  name: string
  /** Full storage path */
  path: string
  /** File size in bytes */
  size: number | null
  /** Last modified timestamp */
  lastModified: string | null
  /** MIME type */
  mimeType: string | null
}

/**
 * Upload a document to the user's private storage folder.
 * 
 * Files are stored in the path: documents/{userId}/{timestamp}-{filename}
 * 
 * @param file - The file to upload
 * @param userId - The authenticated user's ID
 * @returns Upload result with path and metadata
 * @throws StorageError if upload fails
 * 
 * @example
 * ```typescript
 * const result = await uploadDocument(file, user.id)
 * console.log('Uploaded to:', result.path)
 * ```
 */
export async function uploadDocument(
  file: File,
  userId: string
): Promise<UploadResult> {
  const supabase = createBrowserClient()
  
  // Generate unique filename with timestamp to prevent collisions
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${userId}/${timestamp}-${sanitizedName}`
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false, // Don't overwrite existing files
    })
  
  if (error) {
    console.error('Storage upload error:', error)
    throw new StorageError(
      `Failed to upload document: ${error.message}`,
      'Failed to upload document. Please try again.',
      error
    )
  }
  
  return {
    path: data.path,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
  }
}

/**
 * Get a signed URL for accessing a private document.
 * The URL expires after the specified duration.
 * 
 * @param filePath - The storage path of the file
 * @param expiresIn - URL expiration in seconds (default: 60)
 * @returns Signed URL for temporary access
 * @throws StorageError if URL generation fails
 * 
 * @example
 * ```typescript
 * const url = await getDocumentUrl('user-id/doc.pdf')
 * // URL is valid for 60 seconds
 * ```
 */
export async function getDocumentUrl(
  filePath: string,
  expiresIn: number = 60
): Promise<string> {
  const supabase = createBrowserClient()
  
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn)
  
  if (error) {
    console.error('Storage URL error:', error)
    throw new StorageError(
      `Failed to get document URL: ${error.message}`,
      'Failed to access document. Please try again.',
      error
    )
  }
  
  return data.signedUrl
}

/**
 * Delete a document from storage.
 * 
 * @param filePath - The storage path of the file to delete
 * @throws StorageError if deletion fails
 * 
 * @example
 * ```typescript
 * await deleteDocument('user-id/doc.pdf')
 * ```
 */
export async function deleteDocument(filePath: string): Promise<void> {
  const supabase = createBrowserClient()
  
  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath])
  
  if (error) {
    console.error('Storage delete error:', error)
    throw new StorageError(
      `Failed to delete document: ${error.message}`,
      'Failed to delete document. Please try again.',
      error
    )
  }
}

/**
 * List all documents in a user's storage folder.
 * 
 * @param userId - The user's ID to list documents for
 * @returns Array of document metadata
 * @throws StorageError if listing fails
 * 
 * @example
 * ```typescript
 * const documents = await listUserDocuments(user.id)
 * documents.forEach(doc => console.log(doc.name))
 * ```
 */
export async function listUserDocuments(userId: string): Promise<DocumentFile[]> {
  const supabase = createBrowserClient()
  
  const { data, error } = await supabase.storage
    .from('documents')
    .list(userId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
  
  if (error) {
    console.error('Storage list error:', error)
    throw new StorageError(
      `Failed to list documents: ${error.message}`,
      'Failed to load documents. Please try again.',
      error
    )
  }
  
  // Filter out folders and map to DocumentFile type
  return (data || [])
    .filter((item) => item.id !== null) // Filter out folders
    .map((item) => ({
      name: item.name,
      path: `${userId}/${item.name}`,
      size: item.metadata?.size ?? null,
      lastModified: item.updated_at ?? null,
      mimeType: item.metadata?.mimetype ?? null,
    }))
}

/**
 * Download a document and return as a Blob.
 * 
 * @param filePath - The storage path of the file
 * @returns The file as a Blob
 * @throws StorageError if download fails
 */
export async function downloadDocument(filePath: string): Promise<Blob> {
  const supabase = createBrowserClient()
  
  const { data, error } = await supabase.storage
    .from('documents')
    .download(filePath)
  
  if (error) {
    console.error('Storage download error:', error)
    throw new StorageError(
      `Failed to download document: ${error.message}`,
      'Failed to download document. Please try again.',
      error
    )
  }
  
  return data
}
