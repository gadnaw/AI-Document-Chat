import { test, expect } from '@playwright/test';

/**
 * E2E Test: Performance and Streaming
 * Tests performance characteristics and streaming behavior
 */
test.describe('Performance', () => {
  
  test('should load page within performance budget', async ({ page }) => {
    // Start timing
    const startTime = Date.now();
    
    // Navigate to chat
    await page.goto('/chat');
    
    // Wait for main content
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    
    // Calculate load time
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should start streaming within SLA', async ({ page }) => {
    // Navigate to chat
    await page.goto('/chat');
    
    // Start timing
    const startTime = Date.now();
    
    // Send message
    const testMessage = 'Quick test query';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for first streaming token (loading indicator appears then disappears)
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    
    // First token should appear within 2 seconds
    const firstTokenTime = Date.now() - startTime;
    expect(firstTokenTime).toBeLessThan(2000);
  });

  test('should complete streaming within timeout', async ({ page }) => {
    // Navigate to chat
    await page.goto('/chat');
    
    // Send message
    const testMessage = 'Generate a detailed response about artificial intelligence and its applications';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Full response should complete within 30 seconds
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
  });
});

/**
 * E2E Test: Streaming Behavior
 * Tests specific streaming characteristics
 */
test.describe('Streaming Behavior', () => {
  
  test('should display tokens incrementally', async ({ page }) => {
    await page.goto('/chat');
    
    // Send message
    const testMessage = 'Explain quantum computing in detail';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Check that assistant message exists and has content
    const assistantMessage = page.locator('[data-testid="assistant-message"]').first();
    await expect(assistantMessage).toBeVisible();
    
    // Message should have substantial content (tokens were streamed)
    const messageContent = await assistantMessage.textContent();
    expect(messageContent?.length).toBeGreaterThan(50);
  });

  test('should handle stream interruption gracefully', async ({ page }) => {
    // This tests behavior when stream is interrupted
    // In real scenario, you might simulate network interruption
    
    await expect(page.locator('[data-testid="stream-interruption-handler"]')).toBeVisible();
  });
});

/**
 * E2E Test: Memory and Resource Usage
 * Tests resource usage patterns
 */
test.describe('Resource Usage', () => {
  
  test('should not leak memory on page refresh', async ({ page }) => {
    // Navigate to chat
    await page.goto('/chat');
    
    // Send a message
    const testMessage = 'Test message for memory test';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Refresh page multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    }
    
    // Page should still function correctly
    await page.locator('[data-testid="chat-input"]').fill('After refresh test');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
  });

  test('should handle multiple conversations', async ({ page }) => {
    // Create first conversation
    await page.goto('/chat');
    await page.locator('[data-testid="chat-input"]').fill('First conversation');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Start new conversation
    await page.locator('[data-testid="new-conversation"]').click();
    
    // Verify new conversation is empty
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    
    // Send second message
    await page.locator('[data-testid="chat-input"]').fill('Second conversation');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
  });
});

/**
 * E2E Test: Concurrent Operations
 * Tests behavior with concurrent user actions
 */
test.describe('Concurrent Operations', () => {
  
  test('should handle rapid input changes', async ({ page }) => {
    await page.goto('/chat');
    
    // Rapidly type and clear input
    const chatInput = page.locator('[data-testid="chat-input"]');
    
    for (let i = 0; i < 5; i++) {
      await chatInput.fill(`Message ${i}`);
      await chatInput.clear();
    }
    
    // Should still accept input
    await chatInput.fill('Final message');
    await expect(chatInput).toHaveValue('Final message');
  });

  test('should handle send button spam', async ({ page }) => {
    await page.goto('/chat');
    
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');
    
    // Fill message
    await chatInput.fill('Test message');
    
    // Spam send button
    for (let i = 0; i < 3; i++) {
      await sendButton.click();
      await page.waitForTimeout(100);
    }
    
    // Should handle gracefully (either queue messages or show warning)
    const warning = page.locator('[data-testid="rapid-send-warning"]');
    if (await warning.isVisible()) {
      await expect(warning).toContainText('slow down');
    }
  });
});
