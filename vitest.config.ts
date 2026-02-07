import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Test directory and file patterns
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/e2e/**'],
    
    // Test environment
    environment: 'node',
    
    // Test timeout
    testTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      
      // Coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      
      // Include patterns for coverage
      include: [
        'src/lib/**/*.ts',
        'src/lib/**/*.tsx',
        'src/components/**/*.ts',
        'src/components/**/*.tsx',
        'src/hooks/**/*.ts',
        'src/app/api/**/*.ts',
      ],
      
      // Exclude from coverage
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'src/types/**',
        'src/lib/supabase/**',
        'src/lib/storage/**',
      ],
    },
    
    // Global test setup
    setupFiles: ['./tests/unit/setup.ts'],
    
    // Pool options
    pool: 'threads',
    maxThreads: 4,
    
    // Reporter configuration
    reporters: ['default'],
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
