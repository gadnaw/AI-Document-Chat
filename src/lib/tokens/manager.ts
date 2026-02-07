import tiktoken from 'tiktoken';

/**
 * Configuration for token limits
 */
export const TOKEN_LIMITS = {
  // Maximum tokens for the full context (messages + retrieved chunks + response)
  MAX_CONTEXT_TOKENS: 128000,
  // Reserve tokens for the model response
  RESPONSE_RESERVE: 2000,
  // Maximum tokens for retrieved context chunks
  MAX_RETRIEVAL_TOKENS: 60000,
  // Tokens per message estimate (rough guide for UI)
  TOKENS_PER_MESSAGE: 4,
  // Characters per token estimate
  CHARS_PER_TOKEN: 4,
} as const;

/**
 * Interface for a chat message
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Interface for token count breakdown
 */
export interface TokenBreakdown {
  messages: number;
  context: number;
  response: number;
  total: number;
}

/**
 * ContextManager - Handles token counting and context window optimization
 * Uses tiktoken with cl100k_base encoding (GPT-4 compatible)
 */
export class ContextManager {
  private encoder: tiktoken.Encoding;
  private maxContextTokens: number;
  private responseReserve: number;

  constructor(options?: {
    maxContextTokens?: number;
    responseReserve?: number;
  }) {
    // Use cl100k_base for GPT-4 and GPT-3.5 Turbo
    this.encoder = tiktoken.encoding_for_model('gpt-4');
    this.maxContextTokens = options?.maxContextTokens ?? TOKEN_LIMITS.MAX_CONTEXT_TOKENS;
    this.responseReserve = options?.responseReserve ?? TOKEN_LIMITS.RESPONSE_RESERVE;
  }

  /**
   * Count tokens in a single text string
   */
  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }

  /**
   * Count tokens in a chat message
   */
  countMessageTokens(message: ChatMessage): number {
    // Add overhead for message structure
    const contentTokens = this.countTokens(message.content);
    const roleTokens = this.countTokens(`\n${message.role}:`);
    return contentTokens + roleTokens + 1; // +1 for the leading newline
  }

  /**
   * Count tokens in an array of messages
   */
  countMessages(messages: ChatMessage[]): number {
    let total = 0;
    for (const message of messages) {
      total += this.countMessageTokens(message);
    }
    return total;
  }

  /**
   * Count tokens for retrieved context chunks
   */
  countContextTokens(chunks: Array<{ content: string; metadata?: Record<string, unknown> }>): number {
    let total = 0;
    for (const chunk of chunks) {
      total += this.countTokens(chunk.content);
      if (chunk.metadata) {
        total += this.countTokens(JSON.stringify(chunk.metadata));
      }
    }
    return total;
  }

  /**
   * Calculate token breakdown for a request
   */
  calculateBreakdown(messages: ChatMessage[], contextChunks: Array<{ content: string; metadata?: Record<string, unknown> }>): TokenBreakdown {
    const messageTokens = this.countMessages(messages);
    const contextTokens = this.countContextTokens(contextChunks);
    const responseTokens = this.responseReserve;
    const total = messageTokens + contextTokens + responseTokens;

    return {
      messages: messageTokens,
      context: contextTokens,
      response: responseTokens,
      total,
    };
  }

  /**
   * Check if context fits within token limits
   */
  fitsInContext(messages: ChatMessage[], contextChunks: Array<{ content: string; metadata?: Record<string, unknown> }>): boolean {
    const breakdown = this.calculateBreakdown(messages, contextChunks);
    return breakdown.total <= this.maxContextTokens;
  }

  /**
   * Get available tokens for context
   */
  getAvailableTokens(messages: ChatMessage[]): number {
    const messageTokens = this.countMessages(messages);
    return Math.max(0, this.maxContextTokens - messageTokens - this.responseReserve);
  }

  /**
   * Optimize messages using sliding window - keep most recent messages within limit
   * Removes oldest messages first to preserve conversation context
   */
  optimizeMessages(
    messages: ChatMessage[],
    contextChunks: Array<{ content: string; metadata?: Record<string, unknown> }> = []
  ): ChatMessage[] {
    if (this.fitsInContext(messages, contextChunks)) {
      return messages;
    }

    const contextTokens = this.countContextTokens(contextChunks);
    const availableForMessages = this.maxContextTokens - contextTokens - this.responseReserve;

    if (availableForMessages <= 0) {
      // Even with no messages, context is too large
      return [];
    }

    // Work backwards, keeping the most recent messages
    const optimized: ChatMessage[] = [];
    let currentTokens = 0;

    // Always include system prompt if present (it should be first)
    if (messages.length > 0 && messages[0].role === 'system') {
      const systemTokens = this.countMessageTokens(messages[0]);
      if (systemTokens < availableForMessages) {
        optimized.push(messages[0]);
        currentTokens += systemTokens;
      }
    }

    // Add messages from most recent to oldest until we hit the limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'system') continue; // Already handled

      const messageTokens = this.countMessageTokens(message);

      if (currentTokens + messageTokens <= availableForMessages) {
        optimized.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Can't fit this message, stop here
        break;
      }
    }

    return optimized;
  }

  /**
   * Get truncation summary for debugging/UI
   */
  getTruncationSummary(
    originalMessages: ChatMessage[],
    optimizedMessages: ChatMessage[],
    contextChunks: Array<{ content: string; metadata?: Record<string, unknown> }>
  ): {
    originalTokens: number;
    optimizedTokens: number;
    removedMessages: number;
    removedTokens: number;
  } {
    const originalTokens = this.countMessages(originalMessages);
    const optimizedTokens = this.countMessages(optimizedMessages);
    const removedMessages = originalMessages.length - optimizedMessages.length;

    return {
      originalTokens,
      optimizedTokens,
      removedMessages,
      removedTokens: originalTokens - optimizedTokens,
    };
  }

  /**
   * Estimate tokens from character count (for quick UI estimates)
   */
  estimateFromChars(charCount: number): number {
    return Math.ceil(charCount / TOKEN_LIMITS.CHARS_PER_TOKEN);
  }

  /**
   * Estimate tokens from word count (for quick UI estimates)
   */
  estimateFromWords(wordCount: number): number {
    // Average English word is about 4-5 characters + 1 space = ~4.5 chars
    // Using 4 chars per token as conservative estimate
    return Math.ceil(wordCount * 1.25);
  }

  /**
   * Dispose of the encoder (call when done to free memory)
   */
  dispose(): void {
    this.encoder.free();
  }
}

// Singleton instance for convenience
let contextManagerInstance: ContextManager | null = null;

export function getContextManager(options?: {
  maxContextTokens?: number;
  responseReserve?: number;
}): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager(options);
  }
  return contextManagerInstance;
}

export function createContextManager(options?: {
  maxContextTokens?: number;
  responseReserve?: number;
}): ContextManager {
  return new ContextManager(options);
}
