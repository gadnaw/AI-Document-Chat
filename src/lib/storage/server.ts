import { createServerClient, getAdminSupabase } from '@/lib/supabase/server'
import { StorageError } from '@/lib/errors'

/**
 * Result of a document upload operation
 */
export interface ServerUploadResult {
  /** Path where the file is stored */
  path: string
  /** Original filename */
  filename: string
  /** File size in bytes */
  size: number
}

/**
 * Upload a document to storage from the server.
 * Uses service role key to bypass RLS for server-side operations.
 * 
 * @param file - File buffer or Blob to upload
 * @param filename - Original filename
 * @param userId - The user ID to associate with the upload
 * @param mimeType - The file's MIME type
 * @returns Upload result with path
 * @throws StorageError if upload fails
 * 
 * @example
 * ```typescript
 * // In an API route
 * const buffer = await file.arrayBuffer()
 * const result = await uploadDocumentServer(
 *   Buffer.from(buffer),
 *   file.name,
 *   userId,
 *   file.type
 * )
 * ```
 */
export async function uploadDocumentServer(
  file: Buffer | Blob,
  filename: string,
  userId: string,
  mimeType: string
): Promise<ServerUploadResult> {
  const supabase = await getAdminSupabase()
  
  // Generate unique filename with timestamp
  const timestamp = Date.now()
  const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${userId}/${timestamp}-${sanitizedName}`
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    })
  
  if (error) {
    console.error('Server storage upload error:', error)
    throw new StorageError(
      `Failed to upload document: ${error.message}`,
      'Failed to upload document. Please try again.',
      error
    )
  }
  
  const size = Buffer.isBuffer(file) ? file.length : (file as Blob).size
  
  return {
    path: data.path,
    filename,
    size,
  }
}

/**
 * Get a signed URL for accessing a private document.
 * For server-side use (API routes, Server Components).
 * 
 * @param filePath - The storage path of the file
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Signed URL for temporary access
 * @throws StorageError if URL generation fails
 * 
 * @example
 * ```typescript
 * // Get 1-hour access URL for displaying in chat
 * const url = await getSignedUrl('user-id/doc.pdf', 3600)
 * ```
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn)
  
  if (error) {
    console.error('Server signed URL error:', error)
    throw new StorageError(
      `Failed to get document URL: ${error.message}`,
      'Failed to access document.',
      error
    )
  }
  
  return data.signedUrl
}

/**
 * Download a document from storage on the server.
 * 
 * @param filePath - The storage path of the file
 * @returns The file contents as a Buffer
 * @throws StorageError if download fails
 */
export async function downloadDocumentServer(filePath: string): Promise<Buffer> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase.storage
    .from('documents')
    .download(filePath)
  
  if (error) {
    console.error('Server download error:', error)
    throw new StorageError(
      `Failed to download document: ${error.message}`,
      'Failed to download document.',
      error
    )
  }
  
  const buffer = await data.arrayBuffer()
  return Buffer.from(buffer)
}

/**
 * Delete a document from storage (admin operation).
 * Uses service role to ensure deletion succeeds.
 * 
 * @param filePath - The storage path of the file
 * @throws StorageError if deletion fails
 */
export async function deleteDocumentServer(filePath: string): Promise<void> {
  const supabase = await getAdminSupabase()
  
  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath])
  
  if (error) {
    console.error('Server delete error:', error)
    throw new StorageError(
      `Failed to delete document: ${error.message}`,
      'Failed to delete document.',
      error
    )
  }
}

/**
 * Get public URL for a file (only works for public buckets).
 * Note: Our documents bucket is private, so this won't work for it.
 * Use getSignedUrl instead.
 * 
 * @param filePath - The storage path of the file
 * @returns Public URL (if bucket is public)
 */
export async function getPublicUrl(filePath: string): Promise<string> {
  const supabase = await createServerClient()
  
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)
  
  return data.publicUrl
}

/**
 * Check if a file exists in storage.
 * 
 * @param filePath - The storage path to check
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const supabase = await createServerClient()
  
  // Extract folder and filename from path
  const parts = filePath.split('/')
  const filename = parts.pop()
  const folder = parts.join('/')
  
  const { data, error } = await supabase.storage
    .from('documents')
    .list(folder, {
      search: filename,
    })
  
  if (error) {
    console.error('File exists check error:', error)
    return false
  }
  
  return data?.some((file) => file.name === filename) ?? false
}
