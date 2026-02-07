import { createClient } from '@supabase/supabase-js';
import { Citation } from '@/app/api/chat/route';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Message persistence service
 * Handles saving messages and citations to the database
 */

/**
 * Message with citations to persist
 */
export interface MessageWithCitations {
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  tokenCount?: number;
}

/**
 * Persist a message with its citations
 * 
 * @param message - Message data including citations
 * @returns Persisted message ID
 */
export async function persistMessage(message: MessageWithCitations): Promise<string> {
  try {
    // If no conversation ID, create one
    let conversationId = message.conversationId;
    
    if (!conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: message.userId,
          title: message.content.slice(0, 100) + (message.content.length > 100 ? '...' : ''),
        })
        .select('id')
        .single();

      if (convError) {
        console.error('[persistence] Error creating conversation:', convError);
        throw new Error('Failed to create conversation');
      }

      conversationId = conversation.id;
    }

    // Save the message
    const { data: savedMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: message.userId,
        role: message.role,
        content: message.content,
        source_chunks: message.citations.map(c => ({
          documentId: c.documentId,
          chunkId: c.chunkId,
          documentName: c.documentName,
          pageNumber: c.pageNumber,
          similarityScore: c.similarityScore,
          preview: c.preview,
        })),
        token_count: message.tokenCount,
      })
      .select('id')
      .single();

    if (msgError) {
      console.error('[persistence] Error saving message:', msgError);
      throw new Error('Failed to save message');
    }

    // Save citations if any
    if (message.citations.length > 0) {
      const citationsData = message.citations.map(citation => ({
        message_id: savedMessage.id,
        document_id: citation.documentId,
        chunk_id: citation.chunkId,
        page_number: citation.pageNumber,
        highlighted_text: citation.preview,
      }));

      const { error: citError } = await supabase
        .from('citations')
        .insert(citationsData);

      if (citError) {
        console.error('[persistence] Error saving citations:', citError);
        // Don't throw - message is saved, citations are secondary
      }
    }

    return savedMessage.id;

  } catch (error) {
    console.error('[persistence] Error persisting message:', error);
    throw error;
  }
}

/**
 * Get conversation with all messages and citations
 */
export async function getConversationWithMessages(
  conversationId: string,
  userId: string
): Promise<{
  conversation: any;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    citations: any[];
    created_at: string;
  }>;
} | null> {
  try {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return null;
    }

    // Get messages with citations
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        role,
        content,
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
      console.error('[persistence] Error fetching messages:', msgError);
      throw msgError;
    }

    return {
      conversation,
      messages: (messages || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        citations: (msg.citations || []).map((cit: any) => ({
          id: cit.id,
          documentId: cit.document_id,
          chunkId: cit.chunk_id,
          pageNumber: cit.page_number,
          highlightedText: cit.highlighted_text,
        })),
        created_at: msg.created_at,
      })),
    };

  } catch (error) {
    console.error('[persistence] Error getting conversation:', error);
    throw error;
  }
}

/**
 * Update conversation title based on first message
 */
export async function updateConversationTitle(
  conversationId: string,
  firstMessage: string
): Promise<void> {
  try {
    const title = firstMessage.slice(0, 100) + (firstMessage.length > 100 ? '...' : '');

    await supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversationId);

  } catch (error) {
    console.error('[persistence] Error updating title:', error);
    // Non-critical error, don't throw
  }
}
