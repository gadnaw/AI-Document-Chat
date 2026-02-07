/**
 * Duplicate file detection utilities
 * Detects duplicate files using filename and SHA-256 hash comparison
 */

import type { UploadFile, DuplicateReport } from '@/types/upload'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client type for duplicate checking
 * Initialized lazily to avoid SSR issues
 */
let supabaseClient: ReturnType<typeof createClient> | null = null

/**
 * Initialize Supabase client for duplicate checking
 */
function getSupabaseClient(): ReturnType<typeof createClient> {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not configured')
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey)
  }

  return supabaseClient
}

/**
 * Check if a file is a duplicate of files already in the upload queue
 * 
 * @param file - File to check
 * @param queuedFiles - Files already queued for upload
 * @returns DuplicateReport with duplicate information
 * 
 * @example
 * ```typescript
 * const report = checkPreUploadDuplicate(file, queuedFiles)
 * if (report.isDuplicate) {
 *   console.log('Duplicate detected:', report.message)
 * }
 * ```
 */
export function checkPreUploadDuplicate(
  file: File,
  queuedFiles: UploadFile[]
): DuplicateReport {
  const fileName = file.name.toLowerCase()
  const fileSize = file.size

  // Check against queued files
  for (const queuedFile of queuedFiles) {
    const queuedName = queuedFile.name.toLowerCase()

    // Check filename match (case-insensitive)
    const nameMatch = fileName === queuedName

    // Check if we have hash information
    if (queuedFile.sha256) {
      // We'll need to calculate the hash to do definitive comparison
      // For now, filename + size match is strong indicator
      if (nameMatch && fileSize === queuedFile.size) {
        return generateDuplicateReport(true, 'name', {
          name: queuedFile.name,
          id: queuedFile.id,
        })
      }
    } else {
      // Fallback to filename + size comparison
      if (nameMatch && fileSize === queuedFile.size) {
        return generateDuplicateReport(true, 'name', {
          name: queuedFile.name,
          id: queuedFile.id,
        })
      }
    }
  }

  return {
    isDuplicate: false,
    action: 'process',
  }
}

/**
 * Check if a file hash matches an existing document in the database
 * 
 * @param sha256 - SHA-256 hash of the file
 * @param filename - Original filename
 * @param userId - Current user ID (for RLS policies)
 * @returns DuplicateReport with database query results
 * 
 * @example
 * ```typescript
 * const report = await checkServerDuplicate(
 *   'abc123...',
 *   'document.pdf',
 *   'user-uuid'
 * )
 * if (report.isDuplicate) {
 *   console.log('Already uploaded:', report.duplicateOf?.name)
 * }
 * ```
 */
export async function checkServerDuplicate(
  sha256: string,
  filename: string,
  userId: string
): Promise<DuplicateReport> {
  try {
    const supabase = getSupabaseClient()

    // Query for existing document with same SHA-256 hash
    const { data: existingDoc, error } = await supabase
      .from('documents')
      .select('id, name, user_id, created_at')
      .eq('sha256', sha256)
      .eq('user_id', userId)
      .maybeSingle() as { data: { id: string; name: string } | null; error: unknown }

    if (error) {
      console.error('Duplicate check query error:', error)
      // On error, assume not duplicate to avoid false positives
      return {
        isDuplicate: false,
        action: 'process',
      }
    }

    if (existingDoc) {
      return generateDuplicateReport(true, 'sha256', {
        name: existingDoc.name,
        id: existingDoc.id,
      })
    }

    // Also check for same filename within user's documents
    // (some documents might not have sha256 stored)
    const { data: nameMatch } = await supabase
      .from('documents')
      .select('id, name')
      .eq('name', filename.toLowerCase())
      .eq('user_id', userId)
      .maybeSingle() as { data: { id: string; name: string } | null; error: unknown }

    if (nameMatch) {
      return generateDuplicateReport(true, 'name', {
        name: nameMatch.name,
        id: nameMatch.id,
      })
    }

    return {
      isDuplicate: false,
      action: 'process',
    }
  } catch (error) {
    console.error('Duplicate check failed:', error)
    // On error, assume not duplicate
    return {
      isDuplicate: false,
      action: 'process',
    }
  }
}

/**
 * Generate a standardized duplicate detection report
 * 
 * @param isDuplicate - Whether this file is a duplicate
 * @param reason - Type of duplicate match found
 * @param duplicateOf - Details of the original file if duplicate
 * @returns DuplicateReport ready for UI and processing
 */
export function generateDuplicateReport(
  isDuplicate: boolean,
  reason?: 'name' | 'sha256' | 'both',
  duplicateOf?: { name: string; id: string }
): DuplicateReport {
  if (!isDuplicate) {
    return {
      isDuplicate: false,
      action: 'process',
    }
  }

  // Generate user-friendly message
  let message: string
  if (duplicateOf) {
    switch (reason) {
      case 'sha256':
        message = `'${duplicateOf.name}' was skipped (already uploaded)`
        break
      case 'name':
        message = `'${duplicateOf.name}' was skipped (filename already exists)`
        break
      case 'both':
        message = `'${duplicateOf.name}' was skipped (duplicate detected)`
        break
      default:
        message = `'${duplicateOf.name}' was skipped (duplicate)`
    }
  } else {
    message = 'File was skipped (duplicate)'
  }

  return {
    isDuplicate: true,
    reason,
    duplicateOf,
    action: 'skip',
    message,
  }
}

/**
 * Batch check multiple files against the queue and database
 * 
 * @param files - Files to check for duplicates
 * @param queuedFiles - Currently queued files
 * @param userId - Current user ID for database checks
 * @returns Arrays of unique and duplicate files
 */
export async function checkDuplicates(
  files: Array<{ file: File; sha256: string }>,
  queuedFiles: UploadFile[],
  userId: string
): Promise<{
  unique: Array<{ file: File; sha256: string }>
  duplicates: Array<{ file: File; report: DuplicateReport }>
}> {
  const unique: Array<{ file: File; sha256: string }> = []
  const duplicates: Array<{ file: File; report: DuplicateReport }> = []

  for (const { file, sha256 } of files) {
    // Check against queued files first (fast)
    const queueReport = checkPreUploadDuplicate(file, queuedFiles)

    if (queueReport.isDuplicate) {
      duplicates.push({ file, report: queueReport })
      continue
    }

    // Check against database (async)
    const serverReport = await checkServerDuplicate(sha256, file.name, userId)

    if (serverReport.isDuplicate) {
      duplicates.push({ file, report: serverReport })
      continue
    }

    // Not a duplicate, proceed with upload
    unique.push({ file, sha256 })
  }

  return { unique, duplicates }
}

/**
 * Generate a summary of skipped duplicate files
 * 
 * @param duplicates - Array of duplicate file reports
 * @returns Formatted summary string for UI display
 */
export function generateDuplicateSummary(
  duplicates: Array<{ file: File; report: DuplicateReport }>
): string {
  if (duplicates.length === 0) {
    return ''
  }

  const names = duplicates.map((d) => d.file.name)
  
  if (names.length === 1) {
    return `Skipped 1 duplicate file: ${names[0]}`
  }

  return `Skipped ${names.length} duplicate files: ${names.join(', ')}`
}

/**
 * Format duplicate details for API response
 */
export function formatDuplicateForAPI(
  report: DuplicateReport
): { skipped: boolean; duplicateOf?: { name: string; id: string } } {
  return {
    skipped: report.isDuplicate,
    duplicateOf: report.isDuplicate ? report.duplicateOf : undefined,
  }
}
