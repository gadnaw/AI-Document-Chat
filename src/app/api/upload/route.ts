import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import type { UploadAPIResponse } from '@/types/upload'

/**
 * Maximum allowed file size in bytes (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * Initialize Supabase server client
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured')
  }

  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Generate SHA-256 hash of file buffer
 */
async function generateFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * POST /api/upload
 * Handles file uploads with session management and duplicate detection
 */
export async function POST(request: NextRequest): Promise<NextResponse<UploadAPIResponse>> {
  try {
    // Check authentication
    const supabase = getSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        skipped: false,
        sessionId: '',
        error: 'Please sign in to upload files.',
      }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sessionId = formData.get('sessionId') as string | null

    if (!file) {
      return NextResponse.json({
        success: false,
        skipped: false,
        sessionId: sessionId || '',
        error: 'No file provided. Please select a PDF file to upload.',
      }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({
        success: false,
        skipped: false,
        sessionId: sessionId || '',
        error: 'Only PDF files are supported. Please select a PDF file.',
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        skipped: false,
        sessionId: sessionId || '',
        error: 'File exceeds the 50MB size limit.',
      }, { status: 400 })
    }

    // Generate session ID if not provided
    const currentSessionId = sessionId || uuidv4()

    // Calculate file hash
    const fileBuffer = await file.arrayBuffer()
    const sha256 = await generateFileHash(fileBuffer)

    // Check for duplicates
    const { data: existingDoc, error: duplicateError } = await supabase
      .from('documents')
      .select('id, name')
      .eq('sha256', sha256)
      .eq('user_id', user.id)
      .maybeSingle()

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError)
      // Continue with upload on error
    }

    if (existingDoc) {
      // File is a duplicate
      return NextResponse.json({
        success: true,
        skipped: true,
        duplicateOf: {
          name: existingDoc.name,
          id: existingDoc.id,
        },
        sessionId: currentSessionId,
      })
    }

    // Also check for same filename (case-insensitive)
    const { data: nameMatch } = await supabase
      .from('documents')
      .select('id, name')
      .eq('name', file.name.toLowerCase())
      .eq('user_id', user.id)
      .maybeSingle()

    if (nameMatch) {
      return NextResponse.json({
        success: true,
        skipped: true,
        duplicateOf: {
          name: nameMatch.name,
          id: nameMatch.id,
        },
        sessionId: currentSessionId,
      })
    }

    // Upload file to Supabase Storage
    const fileId = uuidv4()
    const storagePath = `${user.id}/${fileId}.pdf`

    const { error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({
        success: false,
        skipped: false,
        sessionId: currentSessionId,
        error: 'Failed to upload file. Please try again.',
      }, { status: 500 })
    }

    // Create document record in database
    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        id: fileId,
        name: file.name,
        size: file.size,
        sha256,
        user_id: user.id,
        storage_path: storagePath,
        status: 'uploading',
        session_id: currentSessionId,
      })

    if (dbError) {
      console.error('Database insert error:', dbError)
      
      // Try to clean up uploaded file
      await supabase.storage.from('documents').remove([storagePath])
      
      return NextResponse.json({
        success: false,
        skipped: false,
        sessionId: currentSessionId,
        error: 'Failed to save file metadata. Please try again.',
      }, { status: 500 })
    }

    // Return success response
    return NextResponse.json({
      success: true,
      fileId,
      skipped: false,
      sessionId: currentSessionId,
    })

  } catch (error) {
    console.error('Upload error:', error)
    
    return NextResponse.json({
      success: false,
      skipped: false,
      sessionId: '',
      error: 'Upload failed. Please try again.',
    }, { status: 500 })
  }
}

/**
 * GET /api/upload
 * Returns upload configuration and requirements
 */
export async function GET(): Promise<NextResponse<{
  maxFileSize: number
  acceptedTypes: string[]
  requirements: string
}>> {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    acceptedTypes: ['application/pdf'],
    requirements: 'PDF files only, maximum 50MB per file',
  })
}
