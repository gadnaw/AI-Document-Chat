/**
 * Processing Trigger API Endpoint
 * POST /api/process/[sessionId] - Triggers document processing pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { documentProcessor } from '@/lib/processors/document-processor';

/**
 * Processing trigger response interface
 */
interface ProcessingTriggerResponse {
  success: boolean;
  processing: boolean;
  filesQueued: number;
  estimatedTime: number;
  error?: string;
}

/**
 * POST /api/process/[sessionId]
 * Triggers the document processing pipeline for files in a session queue
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ProcessingTriggerResponse>> {
  try {
    const { sessionId } = await params;

    // Validate session ID
    if (!sessionId || sessionId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          processing: false,
          filesQueued: 0,
          estimatedTime: 0,
          error: 'Invalid session ID',
        },
        { status: 400 }
      );
    }

    // Check if processing is already in progress for this session
    const isProcessing = await checkProcessingInProgress(sessionId);

    if (isProcessing) {
      return NextResponse.json(
        {
          success: true,
          processing: true,
          filesQueued: 0,
          estimatedTime: 0,
          error: 'Processing already in progress',
        },
        { status: 200 }
      );
    }

    // Get count of pending files for estimation
    const pendingFiles = await getPendingFilesCount(sessionId);

    if (pendingFiles === 0) {
      return NextResponse.json(
        {
          success: false,
          processing: false,
          filesQueued: 0,
          estimatedTime: 0,
          error: 'No files pending processing',
        },
        { status: 400 }
      );
    }

    // Estimate processing time (30 seconds per file)
    const estimatedTime = pendingFiles * 30;

    // Trigger processing (non-blocking)
    // The processing will continue asynchronously
    const processingPromise = documentProcessor.processQueue(sessionId);

    // Don't await the processing - return immediately
    // The client can poll /api/progress/[sessionId] for updates

    return NextResponse.json(
      {
        success: true,
        processing: true,
        filesQueued: pendingFiles,
        estimatedTime,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Processing trigger error:', error);

    return NextResponse.json(
      {
        success: false,
        processing: false,
        filesQueued: 0,
        estimatedTime: 0,
        error: 'Unable to start processing',
      },
      { status: 500 }
    );
  }
}

/**
 * Check if processing is already in progress for a session
 */
async function checkProcessingInProgress(sessionId: string): Promise<boolean> {
  try {
    // This would check the database for active processing
    // Placeholder implementation
    return false;
  } catch (error) {
    console.error('Failed to check processing status:', error);
    return false;
  }
}

/**
 * Get count of pending files for a session
 */
async function getPendingFilesCount(sessionId: string): Promise<number> {
  try {
    // This would query the database for pending files
    // Placeholder implementation
    return 0;
  } catch (error) {
    console.error('Failed to get pending files count:', error);
    return 0;
  }
}

/**
 * GET /api/process/[sessionId]
 * Returns processing status for a session (optional endpoint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<{ processing: boolean; filesProcessed: number; filesPending: number }>> {
  try {
    const { sessionId } = await params;

    // Placeholder implementation
    return NextResponse.json({
      processing: false,
      filesProcessed: 0,
      filesPending: 0,
    });
  } catch (error) {
    console.error('Status check error:', error);

    return NextResponse.json({
      processing: false,
      filesProcessed: 0,
      filesPending: 0,
    });
  }
}
