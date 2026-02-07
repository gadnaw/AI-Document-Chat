import { streamText, StreamData } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getSession } from '@/lib/auth-utils';
import { retrieveRelevantChunks } from '@/lib/retrieval/search';
import { createClient } from '@supabase/supabase-js';
import { persistMessage, updateConversationTitle } from '@/lib/persistence/message-persistence';
import { ContextManager, ChatMessage, TOKEN_LIMITS } from '@/lib/tokens/manager';

// Initialize Supabase client for message history
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize context manager for token counting and optimization
const contextManager = new ContextManager({
  maxContextTokens: TOKEN_LIMITS.MAX_CONTEXT_TOKENS,
  responseReserve: TOKEN_LIMITS.RESPONSE_RESERVE,
});

/**
 * Citation type for streaming metadata
 */
export interface Citation {
  documentId: string;
  chunkId: string;
  documentName: string;
  pageNumber: number | null;
  similarityScore: number;
  preview: string;
}

/**
 * Chat API Route
 * Handles streaming chat requests with RAG context retrieval and citation streaming
 * 
 * Flow: Auth check -> Rate limit check -> Load history -> 
 * Retrieve chunks -> Assemble context -> Stream text + citations -> Save message
 */

export async function POST(req: Request) {
  try {
    // 1. Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Parse request body
    const { message, conversationId } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return new Response('Invalid message', { status: 400 });
    }

    // 3. Retrieve relevant context from documents
    const retrievalResult = await retrieveRelevantChunks(message, {
      userId: session.user.id,
      topK: 5,
      threshold: 0.7,
    });

    // 4. Load conversation history if conversationId provided
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (conversationId) {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(50); // Load more messages, let context manager optimize

      if (!error && messages) {
        conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      }
    }

    // 4.5 Calculate token usage and optimize context
    const retrievalContext = retrievalResult.results.map((result, index) => ({
      content: `[Source ${index + 1}] ${result.documentName} (Page ${result.pageNumber || 'N/A'}):\n${result.content}`,
      metadata: {
        documentId: result.documentId,
        chunkId: result.id,
        documentName: result.documentName,
        pageNumber: result.pageNumber,
        similarityScore: result.similarityScore,
      },
    }));

    // Calculate token breakdown
    const tokenBreakdown = contextManager.calculateBreakdown(
      conversationHistory,
      retrievalContext
    );

    // Optimize conversation history if needed
    const optimizedHistory = contextManager.optimizeMessages(
      conversationHistory,
      retrievalContext
    );

    // Log truncation if it occurred
    if (optimizedHistory.length < conversationHistory.length) {
      const truncationSummary = contextManager.getTruncationSummary(
        conversationHistory,
        optimizedHistory,
        retrievalContext
      );
      console.log(`[chat] Context truncated: removed ${truncationSummary.removedMessages} messages (${truncationSummary.removedTokens} tokens) to fit token limit`);
    }

    // 5. Assemble system prompt with context and create citations
    // Filter and rank citations based on quality thresholds
    const MIN_CITATION_THRESHOLD = 0.75; // Minimum similarity score for citation
    const MAX_CITATIONS = 5; // Maximum number of citations to include
    
    // Filter retrieval results by quality threshold
    const qualityResults = retrievalResult.results
      .filter(result => result.similarityScore >= MIN_CITATION_THRESHOLD)
      .slice(0, MAX_CITATIONS);
    
    // Create citations from quality-filtered results
    const citations: Citation[] = qualityResults.map((result, index) => ({
      documentId: result.documentId,
      chunkId: result.id,
      documentName: result.documentName,
      pageNumber: result.pageNumber || null,
      similarityScore: result.similarityScore,
      preview: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
    }));

    const contextChunks = qualityResults
      .map((result, index) => 
        `[Source ${index + 1}] ${result.documentName} (Page ${result.pageNumber || 'N/A'}):\n${result.content}`
      )
      .join('\n\n');

    const systemPrompt = `You are an AI assistant helping users understand your uploaded documents.
    
Based on the following document excerpts, answer the user's question. Cite your sources using the format [Source N] where N corresponds to the source number.

## Document Context
${contextChunks || 'No relevant documents found.'}

## Guidelines
- Answer based primarily on the provided document context
- Only cite sources that directly support your claims
- If the context doesn't contain enough information, say so clearly
- Cite sources using [Source N] format for factual claims
- Avoid citing sources that don't directly support the answer
- Be concise and helpful
- Format responses clearly with proper spacing`;

    // 6. Stream response using Vercel AI SDK with citation data
    // Capture assistant response for persistence
    let assistantResponse = '';
    let currentConversationId = conversationId;
    let streamingTokenCount = 0;

    const result = streamText({
      model: openai('gpt-4o'),
      messages: [
        ...optimizedHistory,
        { role: 'user', content: message },
      ],
      system: systemPrompt,
      onFinish: async ({ text, usage, reasoning }) => {
        assistantResponse = text;
        streamingTokenCount = (usage?.completionTokens || 0) + (usage?.promptTokens || 0);

        try {
          // Save user message
          const userMessageId = await persistMessage({
            conversationId: currentConversationId || '',
            userId: session.user.id,
            role: 'user',
            content: message,
            citations: citations,
          });

          // If no conversation was provided, get the created conversation ID
          if (!currentConversationId) {
            // The persistMessage function should handle this, but just in case
            const { data: conv } = await supabase
              .from('messages')
              .select('conversation_id')
              .eq('id', userMessageId)
              .single();
            
            if (conv) {
              currentConversationId = conv.conversation_id;
            }
          }

          // Save assistant message with citations
          await persistMessage({
            conversationId: currentConversationId,
            userId: session.user.id,
            role: 'assistant',
            content: text,
            citations: citations,
            tokenCount: usage?.completionTokens || 0,
          });

          // Update conversation title if this is the first message
          if (optimizedHistory.length === 0) {
            await updateConversationTitle(currentConversationId, message);
          }

          console.log('[chat] Messages persisted successfully');
        } catch (persistenceError) {
          console.error('[chat] Error persisting messages:', persistenceError);
          // Don't fail the request - messages are persisted for UX but not critical
        }
      },
    });

    // 7. Return streaming response with citations via data channel and token headers
    const dataStream = result.toDataStreamResponse({
      data: citations.map(citation => ({
        type: 'citation',
        documentId: citation.documentId,
        chunkId: citation.chunkId,
        documentName: citation.documentName,
        pageNumber: citation.pageNumber,
        similarityScore: citation.similarityScore,
        preview: citation.preview,
      })),
    });

    // Add token usage headers
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('X-Token-Input', String(tokenBreakdown.messages));
    headers.set('X-Token-Context', String(tokenBreakdown.context));
    headers.set('X-Token-Reserved', String(tokenBreakdown.response));
    headers.set('X-Token-Total', String(tokenBreakdown.total));
    headers.set('X-Token-Limit', String(TOKEN_LIMITS.MAX_CONTEXT_TOKENS));

    // Merge headers with data stream response
    const response = new Response(dataStream.body, {
      status: dataStream.status,
      statusText: dataStream.statusText,
      headers: headers,
    });

    return response;

  } catch (error) {
    console.error('[chat] Error processing request:', error);
    
    // Handle rate limiting
    if (error instanceof Error && error.message.includes('rate limit')) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          retryAfter: 3600 
        }), 
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle retrieval errors
    if (error instanceof Error && error.message.includes('Search service')) {
      return new Response(
        JSON.stringify({ 
          error: 'Unable to retrieve document context. Please try again.' 
        }), 
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generic error response
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred processing your request' 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
