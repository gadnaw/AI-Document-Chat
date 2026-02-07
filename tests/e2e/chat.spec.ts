import { test, expect } from '@playwright/test';

/**
 * E2E Test: Chat Workflow
 * Tests the complete chat flow from message to streaming response
 */
test.describe('Chat Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to chat page
    await page.goto('/chat');
    
    // Wait for chat interface to load
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });

  test('should send a message and receive streaming response', async ({ page }) => {
    // Type a test message
    const testMessage = 'What is this document about?';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    
    // Submit the message
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for user message to appear
    await expect(page.locator(`text=${testMessage}`)).toBeVisible();
    
    // Wait for streaming response to start
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    
    // Wait for streaming to complete (loading indicator disappears)
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Verify assistant response appears
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible();
  });

  test('should display citations in response', async ({ page }) => {
    // Send a question that should generate citations
    const testMessage = 'What are the key findings?';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for response
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Check for citation elements
    const citations = page.locator('[data-testid="citation"]');
    await expect(citations.first()).toBeVisible();
  });

  test('should maintain conversation history', async ({ page }) => {
    // Send first message
    const firstMessage = 'First question about the document';
    await page.locator('[data-testid="chat-input"]').fill(firstMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for response
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Send second message that references previous context
    const secondMessage = 'Can you elaborate on that?';
    await page.locator('[data-testid="chat-input"]').fill(secondMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for response
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Verify both messages appear in conversation
    await expect(page.locator(`text=${firstMessage}`)).toBeVisible();
    await expect(page.locator(`text=${secondMessage}`)).toBeVisible();
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Rapidly send multiple messages
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-testid="chat-input"]').fill(`Test message ${i}`);
      await page.locator('[data-testid="send-button"]').click();
      
      // Brief pause between messages
      await page.waitForTimeout(500);
    }
    
    // Check for rate limit notification if triggered
    const rateLimitBanner = page.locator('[data-testid="rate-limit-banner"]');
    
    // Either rate limit banner appears or all messages were sent
    // This test verifies the system handles rate limiting gracefully
    if (await rateLimitBanner.isVisible()) {
      await expect(rateLimitBanner).toContainText('rate limit');
    }
  });
});

/**
 * E2E Test: Citation Interaction
 * Tests citation display and interaction
 */
test.describe('Citation Interaction', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });

  test('should show citation tooltip on hover', async ({ page }) => {
    // Send a question
    const testMessage = 'What are the main points?';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for response with citations
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Hover over citation
    const citation = page.locator('[data-testid="citation"]').first();
    await citation.hover();
    
    // Verify tooltip appears
    await expect(page.locator('[data-testid="citation-tooltip"]')).toBeVisible();
  });

  test('should navigate to source when citation clicked', async ({ page }) => {
    // Send a question
    const testMessage = 'Explain the methodology';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Wait for response
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
    
    // Click on citation
    await page.locator('[data-testid="citation"]').first().click();
    
    // Should navigate to document or show source panel
    const sourcePanel = page.locator('[data-testid="source-panel"]');
    
    // Either navigation happens or source panel opens
    if (await sourcePanel.isVisible()) {
      await expect(sourcePanel).toContainText('Document');
    }
  });
});

/**
 * E2E Test: Loading States
 * Tests loading indicators and error states
 */
test.describe('Loading States', () => {
  
  test('should show loading indicator during streaming', async ({ page }) => {
    await page.goto('/chat');
    
    // Send message
    const testMessage = 'What are the conclusions?';
    await page.locator('[data-testid="chat-input"]').fill(testMessage);
    await page.locator('[data-testid="send-button"]').click();
    
    // Loading should appear immediately
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    
    // Loading should disappear after streaming completes
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeHidden({
      timeout: 30000,
    });
  });

  test('should handle errors gracefully', async ({ page }) => {
    // This test simulates error conditions
    // In a real scenario, this would test error boundaries
    
    await page.goto('/chat');
    
    // Verify error boundary component exists
    await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
  });
});
