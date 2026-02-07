/**
 * Client-side PDF file validation utilities
 * Validates files before upload using extension, MIME type, and magic bytes
 */

import type { ValidationResult } from '@/types/upload'

/**
 * Maximum allowed file size in bytes (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * PDF magic bytes signature
 */
const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // "%PDF"

/**
 * Validates a single file for PDF upload requirements
 * 
 * @param file - The file to validate
 * @returns ValidationResult with valid status and error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateFile(selectedFile)
 * if (!result.valid) {
 *   console.error('Validation failed:', result.error)
 * } else {
 *   console.log('File hash:', result.sha256)
 * }
 * ```
 */
export async function validateFile(file: File): Promise<ValidationResult> {
  // Check file extension first (fast fail)
  const extensionResult = validateExtension(file.name)
  if (!extensionResult.valid) {
    return extensionResult
  }

  // Check MIME type
  const mimeResult = validateMimeType(file.type)
  if (!mimeResult.valid) {
    return mimeResult
  }

  // Check file size
  const sizeResult = validateFileSize(file.size)
  if (!sizeResult.valid) {
    return sizeResult
  }

  // Verify magic bytes (handles spoofed extensions)
  const magicResult = await validateMagicBytes(file)
  if (!magicResult.valid) {
    return magicResult
  }

  // Calculate SHA-256 hash for duplicate detection
  const sha256 = await generateFileHash(file)

  return {
    valid: true,
    sha256,
  }
}

/**
 * Validates multiple files and separates valid from invalid
 * 
 * @param files - Array of files to validate
 * @returns Object with arrays of valid and invalid files with their errors
 * 
 * @example
 * ```typescript
 * const { valid, invalid } = await validateMultipleFiles(fileList)
 * console.log(`Valid: ${valid.length}, Invalid: ${invalid.length}`)
 * invalid.forEach(({ file, error }) => {
 *   console.error(`${file.name}: ${error}`)
 * })
 * ```
 */
export async function validateMultipleFiles(
  files: File[]
): Promise<{ valid: File[]; invalid: { file: File; error: string }[] }> {
  const valid: File[] = []
  const invalid: { file: File; error: string }[] = []

  for (const file of files) {
    const result = await validateFile(file)
    if (result.valid) {
      valid.push(file)
    } else {
      invalid.push({
        file,
        error: result.error || 'Unknown validation error',
      })
    }
  }

  return { valid, invalid }
}

/**
 * Validates file extension (case-insensitive .pdf check)
 */
function validateExtension(filename: string): ValidationResult {
  const pdfRegex = /\.pdf$/i
  if (!pdfRegex.test(filename)) {
    const baseName = filename.split('/').pop()?.split('\\').pop() || filename
    return {
      valid: false,
      error: `'${baseName}' was rejected. Only PDF files under 50MB are supported.`,
    }
  }
  return { valid: true }
}

/**
 * Validates MIME type is application/pdf
 */
function validateMimeType(mimeType: string): ValidationResult {
  // Some browsers report different MIME types for PDFs
  const allowedMimeTypes = [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/pdf',
    'text/pdf',
    'text/x-pdf',
  ]

  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type '${mimeType}' is not supported. Only PDF files are allowed.`,
    }
  }

  return { valid: true }
}

/**
 * Validates file size is under 50MB
 */
function validateFileSize(size: number): ValidationResult {
  if (size > MAX_FILE_SIZE) {
    const sizeMB = (size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `'${sizeMB}MB' exceeds the 50MB size limit.`,
    }
  }

  // Also check for zero or negative sizes
  if (size <= 0) {
    return {
      valid: false,
      error: 'File appears to be empty or invalid.',
    }
  }

  return { valid: true }
}

/**
 * Validates PDF magic bytes signature
 * Reads first 4 bytes to verify PDF structure
 */
async function validateMagicBytes(file: File): Promise<ValidationResult> {
  try {
    // Read only first 4 bytes for magic bytes check
    const slice = file.slice(0, 4)
    const buffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Check each byte matches PDF signature
    for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
      if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
        const baseName = file.name.split('/').pop()?.split('\\').pop() || file.name
        return {
          valid: false,
          error: `'${baseName}' is not a valid PDF file. The file structure appears to be corrupted.`,
        }
      }
    }

    return { valid: true }
  } catch (error) {
    // Handle read errors gracefully
    return {
      valid: false,
      error: 'Could not verify file integrity. Please try selecting the file again.',
    }
  }
}

/**
 * Generates SHA-256 hash of a file using Web Crypto API
 * 
 * @param file - The file to hash
 * @returns Hexadecimal string representation of SHA-256 hash
 * 
 * @example
 * ```typescript
 * const hash = await generateFileHash(document)
 * console.log('File SHA-256:', hash)
 * ```
 */
export async function generateFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return hashHex
  } catch (error) {
    // Fallback: return placeholder if crypto API fails
    console.warn('SHA-256 generation failed, using placeholder:', error)
    return `placeholder-${file.name}-${file.size}`
  }
}

/**
 * Validates a file is a valid PDF and returns formatted result
 * User-friendly messages for UI display
 * 
 * @param file - File to validate
 * @returns Object with validation status and user-friendly message
 */
export async function validateFileForUpload(
  file: File
): Promise<{ isValid: boolean; message: string; sha256?: string }> {
  const result = await validateFile(file)

  if (result.valid) {
    return {
      isValid: true,
      message: 'File is ready for upload',
      sha256: result.sha256,
    }
  }

  return {
    isValid: false,
    message: result.error || 'File validation failed',
  }
}

/**
 * Batch validates files and returns summary
 * Useful for drag-and-drop validation feedback
 */
export async function validateFilesForUpload(
  files: File[]
): Promise<{
  ready: Array<{ file: File; sha256: string }>
  rejected: Array<{ file: File; reason: string }>
  summary: string
}> {
  const { valid, invalid } = await validateMultipleFiles(files)

  const ready = await Promise.all(
    valid.map(async (file) => {
      const sha256 = await generateFileHash(file)
      return { file, sha256 }
    })
  )

  const rejected = invalid.map(({ file, error }) => ({
    file,
    reason: error,
  }))

  let summary: string
  if (ready.length === 0 && rejected.length === 0) {
    summary = 'No files selected'
  } else if (rejected.length === 0) {
    summary = `All ${ready.length} file(s) are ready for upload`
  } else if (ready.length === 0) {
    summary = `${rejected.length} file(s) were rejected`
  } else {
    summary = `${ready.length} file(s) ready, ${rejected.length} rejected`
  }

  return { ready, rejected, summary }
}
