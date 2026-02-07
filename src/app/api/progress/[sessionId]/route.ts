import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ProgressResponse, FileStatus } from '@/types/upload'

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
 * Validate UUID v4 format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Calculate progress percentage based on file status
 * For upload stage: progress is stored in database
 * For other stages: placeholders until w02b implements actual processing
 */
function calculateProgress(status: FileStatus, storedProgress: number | null): number {
  switch (status) {
    case 'pending':
      return 0
    case 'uploading':
      return storedProgress ?? 0
    case 'parsing':
      // Placeholder: 30% of processing time
      return 30
    case 'chunking':
      // Placeholder: 40% of processing time
      return 70
    case 'embedding':
      // Placeholder: 30% of processing time
      return 90
    case 'complete':
      return 100
    case 'error':
      return storedProgress ?? 0
    case 'skipped':
      return 100
    default:
      return 0
  }
}

/**
 * GET /api/progress/[sessionId]
 * Returns current progress for all files in a session
 * 
 * @param request - NextRequest with sessionId in params
 * @returns ProgressResponse with polling data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
): Promise<NextResponse<ProgressResponse | { error: string }>> {
  try {
    const { sessionId } = params

    // Validate sessionId format
    if (!sessionId || !isValidUUID(sessionId)) {
      return NextResponse.json({
        error: 'Invalid session ID format.',
      }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Get user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        error: 'Please sign in to view progress.',
      }, { status: 401 })
    }

    // Query all files in session
    const { data: files, error: queryError } = await supabase
      .from('documents')
      .select(`
        id,
        name,
        size,
        status,
        progress,
        error_message,
        sha256,
        session_id,
        created_at,
        processing_started_at,
        processing_completed_at
      `)
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (queryError) {
      console.error('Progress query error:', queryError)
      return NextResponse.json({
        error: 'Failed to retrieve progress.',
      }, { status: 500 })
    }

    // Handle empty session (no files yet)
    if (!files || files.length === 0) {
      return NextResponse.json({
        sessionId,
        files: [],
        completedCount: 0,
        totalCount: 0,
        skippedFiles: [],
        processingFile: undefined,
        overallProgress: 0,
      })
    }

    // Process files and calculate progress
    const processedFiles = files.map((file) => {
      const progress = calculateProgress(
        file.status as FileStatus, 
        file.progress
      )

      return {
        id: file.id,
        name: file.name,
        size: file.size,
        status: file.status as FileStatus,
        progress,
        error: file.error_message || undefined,
        sha256: file.sha256 || undefined,
        sessionId: file.session_id,
        createdAt: new Date(file.created_at),
      }
    })

    // Count completed, skipped, and processing files
    const completedCount = files.filter(
      (f) => f.status === 'complete'
    ).length

    const skippedFiles = files
      .filter((f) => f.status === 'skipped')
      .map((f) => f.name)

    // Find currently processing file
    const processingFile = files.find(
      (f) => 
        f.status === 'uploading' || 
        f.status === 'parsing' || 
        f.status === 'chunking' || 
        f.status === 'embedding'
    )?.name

    // Calculate overall progress
    const processedCount = completedCount + skippedFiles.length
    const totalCount = files.length
    const overallProgress = totalCount > 0 
      ? Math.round((processedCount / totalCount) * 100) 
      : 0

    // Build response
    const response: ProgressResponse = {
      sessionId,
      files: processedFiles,
      completedCount,
      totalCount,
      skippedFiles,
      processingFile,
      overallProgress,
    }

    // Set cache headers to prevent caching
    const nextResponse = NextResponse.json(response)
    nextResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    nextResponse.headers.set('Pragma', 'no-cache')
    nextResponse.headers.set('Expires', '0')

    return nextResponse

  } catch (error) {
    console.error('Progress API error:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve progress. Please try again.',
    }, { status: 500 })
  }
}
