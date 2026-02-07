// @ts-check

const { withSentryConfig } = require('@sentry/nextjs');

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Enable experimental features if needed
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Headers for security
  async headers() {
    return [
      // Content Security Policy - Primary XSS protection
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.sentry.io https://api.openai.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.openai.com https://*.supabase.co wss://*.supabase.co https://api.sentry.io",
              "frame-src 'self'",
              "worker-src 'self' blob:",
            ].join('; '),
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  
  // Image optimization
  images: {
    domains: [
      'localhost',
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || '',
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_NAME: 'AI Document Chat',
  },
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: 'tsconfig.json',
  },
  
  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'tests', 'scripts'],
  },
};

/**
 * Sentry configuration
 * 
 * Configures source map upload and error tracking integration.
 * This runs during the build process to upload source maps to Sentry.
 */
const sentryConfig = {
  // Source map upload configuration
  silent: false, // Show Sentry upload progress
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT || 'ai-document-chat',
  
  // Auth token is automatically read from SENTRY_AUTH_TOKEN env var
  // Uncomment and set explicitly if needed:
  // authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Additional upload options
  uploadSourceMaps: true,
  inject: true,
  
  // Include/exclude paths for source map upload
  include: {
    // Files to include in source map upload
    paths: ['.next'],
    // Files to exclude
    ignore: ['node_modules'],
  },
  
  // Automatically configure Release and Source Maps
  configureSentry: {
    // Enable automatic release detection
    autoAssignRelease: true,
    // URL prefix for uploaded source files
    urlPrefix: '~/_next',
  },
};

/**
 * Wrap Next.js configuration with Sentry plugin
 * 
 * The Sentry plugin automatically:
 * - Instruments API routes with error tracking
 * - Generates source maps during build
 * - Uploads source maps to Sentry
 * - Adds Sentry init to client and server bundles
 */
const sentryWebpackPluginOptions = {
  // General options
  silent: false,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT || 'ai-document-chat',
  
  // Authentication
  // Auth token should be set in SENTRY_AUTH_TOKEN environment variable
  // You can create one at: https://sentry.io/settings/auth-tokens/
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Source map upload
  uploadSourceMaps: true,
  inject: true,
  
  // Specify which files to include
  include: '.next',
  
  // Specify which files to exclude
  ignore: ['node_modules'],
  
  // Additional configuration
  // DeleteSourceMapsAfterUpload: true, // Delete source maps after upload (recommended for production)
  // urlPrefix: '~/_next', // URL prefix for source maps
};

// Only wrap with Sentry if auth token is available
// This allows development without Sentry credentials
if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG) {
  module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
} else {
  console.warn('⚠️  Sentry configuration incomplete - Sentry integration disabled');
  console.warn('   Set SENTRY_AUTH_TOKEN and SENTRY_ORG to enable Sentry integration');
  module.exports = nextConfig;
}

/**
 * Environment Variables Documentation
 * 
 * Required for Sentry:
 * - SENTRY_ORG: Your Sentry organization slug
 * - SENTRY_PROJECT: Your Sentry project name (default: 'ai-document-chat')
 * - SENTRY_AUTH_TOKEN: Auth token from https://sentry.io/settings/auth-tokens/
 * 
 * Optional:
 * - NEXT_PUBLIC_SENTRY_DSN: Client-side DSN (auto-configured by @sentry/nextjs)
 * - SENTRY_DSN: Server-side DSN (auto-configured by @sentry/nextjs)
 * 
 * Setup Commands:
 * 1. npm install @sentry/nextjs @sentry/node
 * 2. npx sentry-wizard -i nextjs
 * 3. Set environment variables
 * 4. Add SENTRY_ORG and SENTRY_AUTH_TOKEN to deployment environment
 */
