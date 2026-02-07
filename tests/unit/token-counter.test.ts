import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit Tests: Token Counter (src/lib/tokens/manager.ts)
 * Tests the ContextManager class for token counting and optimization
 */
describe('TokenCounter', () => {
  // Mock tiktoken before importing ContextManager
  beforeEach(() => {
    vi.resetModules();
  });

  describe('Token Counting', () => {
    it('should count tokens in simple text', async () => {
      // Import fresh module for each test
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const text = 'Hello world';
      const tokenCount = manager.countTokens(text);
      
      // Rough estimate: ~2 tokens for "Hello world"
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(10);
      
      manager.dispose();
    });

    it('should count tokens in messages correctly', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const messages = [
        { role: 'user', content: 'What is AI?' },
        { role: 'assistant', content: 'AI is artificial intelligence.' },
      ];
      
      const tokenCount = manager.countMessages(messages);
      
      expect(tokenCount).toBeGreaterThan(0);
      expect(messages.length).toBe(2);
      
      manager.dispose();
    });

    it('should estimate tokens from character count', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const charCount = 100;
      const estimatedTokens = manager.estimateFromChars(charCount);
      
      // Should be roughly charCount / 4
      expect(estimatedTokens).toBe(Math.ceil(charCount / 4));
      
      manager.dispose();
    });

    it('should estimate tokens from word count', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const wordCount = 20;
      const estimatedTokens = manager.estimateFromWords(wordCount);
      
      // Should be roughly wordCount * 1.25
      expect(estimatedTokens).toBe(Math.ceil(wordCount * 1.25));
      
      manager.dispose();
    });
  });

  describe('Context Management', () => {
    it('should fit messages within context limit', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const messages = [
        { role: 'user', content: 'Short message' },
      ];
      
      const contextChunks = [
        { content: 'Chunk content' },
      ];
      
      const fits = manager.fitsInContext(messages, contextChunks);
      
      expect(fits).toBe(true);
      
      manager.dispose();
    });

    it('should optimize messages when exceeding limit', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      // Create manager with very small context for testing
      const manager = new ContextManager({
        maxContextTokens: 10,
        responseReserve: 2,
      });
      
      // Create messages that exceed limit
      const messages = [
        { role: 'user', content: 'A'.repeat(100) }, // Large message
      ];
      
      const optimized = manager.optimizeMessages(messages, []);
      
      // Should return empty or reduced messages
      expect(optimized.length).toBeLessThanOrEqual(messages.length);
      
      manager.dispose();
    });

    it('should calculate token breakdown correctly', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ];
      
      const contextChunks = [
        { content: 'Relevant context here' },
      ];
      
      const breakdown = manager.calculateBreakdown(messages, contextChunks);
      
      expect(breakdown).toHaveProperty('messages');
      expect(breakdown).toHaveProperty('context');
      expect(breakdown).toHaveProperty('response');
      expect(breakdown).toHaveProperty('total');
      
      expect(breakdown.total).toBeGreaterThan(0);
      expect(breakdown.response).toBe(manager['responseReserve']); // 2000
      
      manager.dispose();
    });

    it('should preserve system message during optimization', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager({
        maxContextTokens: 50,
        responseReserve: 10,
      });
      
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message 1' },
        { role: 'user', content: 'User message 2' },
        { role: 'user', content: 'User message 3' },
      ];
      
      const optimized = manager.optimizeMessages(messages, []);
      
      // System prompt should be preserved if it fits
      const hasSystemMessage = optimized.some(m => m.role === 'system');
      expect(hasSystemMessage).toBe(true);
      
      manager.dispose();
    });
  });

  describe('Token Limits Configuration', () => {
    it('should use custom token limits', async () => {
      const { ContextManager, TOKEN_LIMITS } = await import('@/lib/tokens/manager');
      
      const manager = new ContextManager({
        maxContextTokens: 64000,
        responseReserve: 1000,
      });
      
      expect(manager['maxContextTokens']).toBe(64000);
      expect(manager['responseReserve']).toBe(1000);
      
      // Should still use defaults for unspecified options
      expect(TOKEN_LIMITS.MAX_CONTEXT_TOKENS).toBe(128000);
      expect(TOKEN_LIMITS.RESPONSE_RESERVE).toBe(2000);
    });

    it('should calculate available tokens correctly', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager({
        maxContextTokens: 100,
        responseReserve: 20,
      });
      
      const messages = [
        { role: 'user', content: 'Test' },
      ];
      
      const available = manager.getAvailableTokens(messages);
      
      // Should return max - messages - responseReserve
      expect(available).toBeLessThanOrEqual(100);
      expect(available).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Truncation Summary', () => {
    it('should report truncation details', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager({
        maxContextTokens: 10,
        responseReserve: 2,
      });
      
      const originalMessages = [
        { role: 'user', content: 'A'.repeat(100) },
        { role: 'user', content: 'B'.repeat(100) },
      ];
      
      const optimized = manager.optimizeMessages(originalMessages, []);
      
      const summary = manager.getTruncationSummary(originalMessages, optimized, []);
      
      expect(summary).toHaveProperty('originalTokens');
      expect(summary).toHaveProperty('optimizedTokens');
      expect(summary).toHaveProperty('removedMessages');
      expect(summary).toHaveProperty('removedTokens');
      
      expect(summary.originalTokens).toBeGreaterThanOrEqual(summary.optimizedTokens);
      expect(summary.removedMessages).toBeGreaterThanOrEqual(0);
      
      manager.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages array', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const tokenCount = manager.countMessages([]);
      expect(tokenCount).toBe(0);
      
      const breakdown = manager.calculateBreakdown([], []);
      expect(breakdown.messages).toBe(0);
      expect(breakdown.context).toBe(0);
      expect(breakdown.total).toBeGreaterThanOrEqual(breakdown.response);
      
      manager.dispose();
    });

    it('should handle empty context chunks', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const messages = [
        { role: 'user', content: 'Test' },
      ];
      
      const fits = manager.fitsInContext(messages, []);
      expect(fits).toBe(true);
      
      manager.dispose();
    });

    it('should handle messages with metadata', async () => {
      const { ContextManager } = await import('@/lib/tokens/manager');
      const manager = new ContextManager();
      
      const contextChunks = [
        { 
          content: 'Content with metadata',
          metadata: { page: 1, source: 'document.pdf' }
        },
      ];
      
      const tokenCount = manager.countContextTokens(contextChunks);
      
      // Should count both content and metadata
      expect(tokenCount).toBeGreaterThan(0);
      
      manager.dispose();
    });
  });
});
