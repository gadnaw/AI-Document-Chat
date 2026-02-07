import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from .env.test file
 * Environment variables should include:
 * - NEXT_PUBLIC_SUPABASE_URL: Test Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Test Supabase anonymous key
 * - OPENAI_API_KEY: OpenAI API key for testing
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  // Global timeout for streaming responses
  timeout: 30000,
  
  // Auto-wait settings for streaming responses
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: true,
    
    // Auto-wait settings for streaming and dynamic content
    autoWaitTimeout: 5000,
    dependOnSelectorTimeout: 5000,
    
    // Navigation settings
    navigationTimeout: 30000,
    
    // Action settings for better streaming handling
    actionTimeout: 10000,
  },

  // Configure web server for test execution
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Test matching patterns
  testMatch: '**/*.spec.ts',
  
  // Ignore patterns
  testIgnore: ['**/node_modules/**', '**/.next/**'],
  
  // Dependency files that trigger re-run
  dependencies: ['install-browsers'],
});
