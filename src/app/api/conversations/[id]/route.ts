import { getSession } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Conversation ID API Route
 * Handles single conversation operations
 * 
 * GET /api/conversations/[id] - Get conversation with messages
 * DELETE /api/conversations/[id] - Delete conversation
 */

/**
 * GET /api/conversations/[id]
 * Returns conversation with its messages and citations
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Validate UUID format
    if (!conversationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid conversation ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch conversation with RLS check
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single();

    if (convError || !conversation) {
      return new NextResponse(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch messages with citations
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        role,
        content,
        source_chunks,
        token_count,
        created_at,
        citations (
          id,
          document_id,
          chunk_id,
          page_number,
          highlighted_text
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('[conversations] Error fetching messages:', msgError);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format messages with their citations
    const formattedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      sourceChunks: msg.source_chunks,
      tokenCount: msg.token_count,
      createdAt: msg.created_at,
      citations: (msg.citations || []).map((cit: any) => ({
        id: cit.id,
        documentId: cit.document_id,
        chunkId: cit.chunk_id,
        pageNumber: cit.page_number,
        highlightedText: cit.highlighted_text,
      })),
    }));

    return NextResponse.json({
      conversation: {
        ...conversation,
        message_count: messages?.length || 0,
      },
      messages: formattedMessages,
    });

  } catch (error) {
    console.error('[conversations] Error in GET [id]:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 * Deletes a conversation and all its messages/citations
 * (Cascade delete configured at database level)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Validate UUID format
    if (!conversationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid conversation ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // First verify ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single();

    if (convError || !conversation) {
      return new NextResponse(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete conversation (cascade will remove messages and citations)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteError) {
      console.error('[conversations] Error deleting conversation:', deleteError);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to delete conversation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('[conversations] Error in DELETE [id]:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
