import { getSession } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Conversations API Route
 * Handles conversation CRUD operations for the current user
 * 
 * GET /api/conversations - List all conversations
 * POST /api/conversations - Create new conversation
 */

/**
 * GET /api/conversations
 * Returns list of user's conversations ordered by updated_at descending
 */
export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch conversations for user
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[conversations] Error fetching conversations:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to fetch conversations' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get message count for each conversation
    const conversationsWithCounts = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        return {
          ...conv,
          message_count: count || 0,
        };
      })
    );

    return NextResponse.json({
      conversations: conversationsWithCounts,
      total: conversationsWithCounts.length,
    });

  } catch (error) {
    console.error('[conversations] Error in GET:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/conversations
 * Creates a new conversation for the current user
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { title } = await req.json();

    // Validate input
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        user_id: session.user.id,
        title: title.trim().slice(0, 200), // Limit title length
      })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) {
      console.error('[conversations] Error creating conversation:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to create conversation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json({
      conversation: {
        ...conversation,
        message_count: 0,
      },
    });

  } catch (error) {
    console.error('[conversations] Error in POST:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
