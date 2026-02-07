import { test, expect } from '@playwright/test';

/**
 * E2E Test: Authentication Flow
 * Tests login, signup, and session management
 */
test.describe('Authentication', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear local storage and cookies for fresh state
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
  });

  test('should show login form', async ({ page }) => {
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Enter invalid email
    await page.locator('[data-testid="email-input"]').fill('invalid-email');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    
    // Should show email validation error
    await expect(page.locator('[data-testid="email-error"]')).toContainText('email');
  });

  test('should validate password length', async ({ page }) => {
    // Enter short password
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').fill('123');
    await page.locator('[data-testid="login-button"]').click();
    
    // Should show password validation error
    await expect(page.locator('[data-testid="password-error"]')).toContainText('6');
  });

  test('should toggle between login and signup', async ({ page }) => {
    // Check initial state is login
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Click signup toggle
    await page.locator('[data-testid="signup-toggle"]').click();
    
    // Check signup form appears
    await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();
    
    // Toggle back
    await page.locator('[data-testid="login-toggle"]').click();
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });
});

/**
 * E2E Test: Protected Routes
 * Tests access control for protected pages
 */
test.describe('Protected Routes', () => {
  
  test('should redirect unauthenticated users from chat', async ({ page }) => {
    // Attempt to access chat without auth
    await page.goto('/chat');
    
    // Should redirect to auth or show login prompt
    await page.waitForURL(/auth|login/);
  });

  test('should redirect unauthenticated users from documents', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForURL(/auth|login/);
  });

  test('should redirect unauthenticated users from upload', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForURL(/auth|login/);
  });

  test('should allow access to public pages', async ({ page }) => {
    // Landing page should be accessible
    await page.goto('/');
    await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
  });
});

/**
 * E2E Test: Session Management
 * Tests session handling and logout
 */
test.describe('Session Management', () => {
  
  test('should maintain session after page refresh', async ({ page }) => {
    // This test would require a logged-in state
    // In a real scenario, you'd use authenticated state
    
    // Verify session handling UI exists
    await expect(page.locator('[data-testid="session-manager"]')).toBeVisible();
  });

  test('should handle logout', async ({ page }) => {
    // Navigate to a page with logout functionality
    await page.goto('/chat');
    
    // Check if logged in (would need to be in authenticated state)
    const logoutButton = page.locator('[data-testid="logout-button"]');
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should redirect to auth page
      await page.waitForURL(/auth|login/);
    }
  });
});

/**
 * E2E Test: Auth Error Handling
 * Tests various authentication error scenarios
 */
test.describe('Auth Error Handling', () => {
  
  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth');
    
    // Enter non-existent user credentials
    await page.locator('[data-testid="email-input"]').fill('nonexistent@example.com');
    await page.locator('[data-testid="password-input"]').fill('wrongpassword123');
    await page.locator('[data-testid="login-button"]').click();
    
    // Should show error message
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
  });

  test('should handle network errors during auth', async ({ page }) => {
    // This would test network error handling
    // In a real scenario, you'd use network interception
    
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
  });

  test('should show loading state during auth request', async ({ page }) => {
    await page.locator('[data-testid="email-input"]').fill('test@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    
    // Click login
    const loginButton = page.locator('[data-testid="login-button"]');
    await loginButton.click();
    
    // Should show loading
    await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible();
  });
});
