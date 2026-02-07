import { getSession } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Conversation Title API Route
 * PATCH /api/conversations/[id]/title - Update conversation title
 */

/**
 * PATCH /api/conversations/[id]/title
 * Updates the title of a conversation
 */
export async function PATCH(
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

    const { title } = await req.json();

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // First verify ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title')
      .eq('id', conversationId)
      .eq('user_id', session.user.id)
      .single();

    if (convError || !conversation) {
      return new NextResponse(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update title
    const { data: updated, error: updateError } = await supabase
      .from('conversations')
      .update({
        title: title.trim().slice(0, 200), // Limit title length
      })
      .eq('id', conversationId)
      .select('id, title, updated_at')
      .single();

    if (updateError) {
      console.error('[conversations] Error updating title:', updateError);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update title' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json({
      conversation: updated,
    });

  } catch (error) {
    console.error('[conversations] Error in PATCH [id]/title:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
