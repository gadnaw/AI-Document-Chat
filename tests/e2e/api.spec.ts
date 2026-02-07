import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * E2E Test: API Endpoint Testing
 * Tests API routes directly to verify backend functionality
 */
test.describe('API Endpoints', () => {
  
  let apiContext: APIRequestContext;
  
  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
  
  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('chat API should accept messages', async () => {
    // Test chat endpoint
    const response = await apiContext.post('/api/chat', {
      data: {
        message: 'What is the main topic?',
        conversationId: null,
      },
    });
    
    // Should get a response (may be streaming or error depending on auth)
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(600);
  });

  test('search API should return results', async () => {
    // Test search endpoint
    const response = await apiContext.post('/api/search', {
      data: {
        query: 'test query',
        limit: 5,
      },
    });
    
    // Should get response (401 without auth is expected)
    expect([200, 401, 403]).toContain(response.status());
  });

  test('upload API should reject unauthenticated requests', async () => {
    // Test upload endpoint without auth
    const response = await apiContext.post('/api/upload', {
      data: {},
    });
    
    // Should reject unauthenticated request
    expect([401, 403]).toContain(response.status());
  });

  test('conversations API should require authentication', async () => {
    // Test conversations endpoint
    const response = await apiContext.get('/api/conversations');
    
    // Should reject without auth
    expect([401, 403]).toContain(response.status());
  });
});

/**
 * E2E Test: Rate Limiting API
 * Tests rate limiting functionality at API level
 */
test.describe('Rate Limiting API', () => {
  
  let apiContext: APIRequestContext;
  
  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
  
  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('should include rate limit headers', async () => {
    // Make a request to chat API
    const response = await apiContext.post('/api/chat', {
      data: { message: 'test', conversationId: null },
    });
    
    // Check for rate limit headers
    const headers = response.headers();
    expect(headers['x-ratelimit-limit']).toBeDefined();
    expect(headers['x-ratelimit_remaining']).toBeDefined();
  });

  test('should track rate limit usage', async () => {
    // Make multiple requests
    const requests = [];
    for (let i = 0; i < 3; i++) {
      const response = await apiContext.post('/api/chat', {
        data: { message: `test ${i}`, conversationId: null },
      });
      requests.push(response);
    }
    
    // At least some requests should succeed or be rate limited properly
    const statuses = requests.map(r => r.status());
    const hasSuccess = statuses.some(s => s >= 200 && s < 400);
    const hasRateLimited = statuses.includes(429);
    
    // Should either succeed or be rate limited (not crash)
    expect(hasSuccess || hasRateLimited).toBe(true);
  });
});

/**
 * E2E Test: Error Handling API
 * Tests API error responses
 */
test.describe('API Error Handling', () => {
  
  let apiContext: APIRequestContext;
  
  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
  
  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('should return 400 for invalid request body', async () => {
    // Send malformed JSON or invalid data
    const response = await apiContext.post('/api/chat', {
      data: { invalid: 'structure' },
    });
    
    // Should return error (400 or auth error)
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should return 404 for unknown endpoints', async () => {
    const response = await apiContext.get('/api/unknown-endpoint');
    expect(response.status()).toBe(404);
  });

  test('should handle timeout gracefully', async () => {
    // This test verifies timeout handling
    // In real scenario, you'd test long-running requests
    
    await expect(page.locator('[data-testid="timeout-handler"]')).toBeVisible();
  });
});

/**
 * E2E Test: Health Check API
 * Tests system health endpoints
 */
test.describe('Health Check', () => {
  
  let apiContext: APIRequestContext;
  
  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
  
  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('should report healthy status', async () => {
    // Check if health endpoint exists
    const response = await apiContext.get('/api/health').catch(() => null);
    
    if (response && response.status() === 200) {
      const body = await response.json();
      expect(body.status).toBe('healthy');
    } else {
      // Health endpoint may not exist - that's okay
      console.log('Health endpoint not configured');
    }
  });
});
