// Vitest global setup file
// Configures test environment and global mocks

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role.test';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:6379';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

// Mock tiktoken for unit tests to avoid heavy initialization
vi.mock('tiktoken', () => ({
  default: {
    encoding_for_model: vi.fn(() => ({
      encode: vi.fn((text: string) => ({
        length: Math.ceil(text.length / 4),
      })),
      free: vi.fn(),
    })),
  },
}));

// Mock @upstash/redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    quit: vi.fn().mockResolvedValue('OK'),
  })),
}));

// Mock @upstash/ratelimit
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      remaining: 50,
      reset: Date.now() / 1000 + 3600,
    }),
  })),
}));
