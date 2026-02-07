/**
 * k6 Load Test Configuration
 * Provides centralized configuration for all load test scenarios
 */

// Environment configuration
export const CONFIG = {
  // Base URL for testing
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  
  // Authentication
  authToken: __ENV.AUTH_TOKEN || '',
  
  // Test data paths
  testDocuments: {
    small: './test-data/small.pdf',
    medium: './test-data/medium.pdf',
    large: './test-data/large.pdf',
  },
  
  // Test parameters
  concurrentUsers: parseInt(__ENV.CONCURRENT_USERS) || 10,
  testDuration: __ENV.DURATION || '10m',
  
  // SLA thresholds (in milliseconds)
  thresholds: {
    documentProcessing: {
      target: 30000,  // 30 seconds
      warning: 25000,
    },
    queryLatency: {
      target: 2000,   // 2 seconds
      warning: 1500,
    },
    searchLatency: {
      target: 2000,
      warning: 1500,
    },
    streamingStart: {
      target: 500,    // 500ms to first byte
      warning: 400,
    },
  },
  
  // Error rate thresholds
  errorRates: {
    acceptable: 0.01,   // 1%
    warning: 0.05,      // 5%
  },
  
  // Throughput targets
  throughput: {
    min: 5,    // Minimum 5 requests per second
    target: 10, // Target 10 requests per second
  },
};

// Scenario configurations
export const SCENARIOS = {
  smoke: {
    name: 'smoke-test',
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  
  load: {
    name: 'load-test',
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 10 },
      { duration: '2m', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 0 },
    ],
  },
  
  stress: {
    name: 'stress-test',
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 30 },
      { duration: '5m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
  
  soak: {
    name: 'soak-test',
    executor: 'constant-vus',
    vus: 20,
    duration: '60m',
  },
  
  performance: {
    name: 'performance-test',
    executor: 'constant-arrival-rate',
    rate: 5,
    timeUnit: '1s',
    duration: '10m',
    preAllocatedVUs: 10,
    maxVUs: 50,
  },
};

// Test data generation
export function generateTestQuery() {
  const queries = [
    'What are the main findings?',
    'Explain the methodology used',
    'What conclusions are drawn?',
    'Summarize the key points',
    'Describe the results',
    'What recommendations are made?',
    'Explain the theoretical framework',
    'What data was collected?',
    'Describe the study population',
    'What limitations were identified?',
  ];
  
  return queries[Math.floor(Math.random() * queries.length)];
}

export function generateTestDocumentName() {
  const prefixes = ['research', 'report', 'paper', 'analysis', 'study'];
  const extensions = ['pdf', 'docx', 'txt'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const extension = extensions[Math.floor(Math.random() * extensions.length)];
  const id = Math.random().toString(36).substring(7);
  
  return `${prefix}-${id}.${extension}`;
}

export function generateTestUserId() {
  return `load-test-user-${Math.random().toString(36).substring(7)}`;
}

// API endpoints
export const ENDPOINTS = {
  chat: '/api/chat',
  search: '/api/search',
  upload: '/api/upload',
  conversations: '/api/conversations',
  documents: '/api/documents',
  health: '/api/health',
  progress: '/api/progress',
};

// HTTP methods
export const METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

// Status codes
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

// Validation helpers
export function isSuccess(status) {
  return status >= 200 && status < 300;
}

export function isClientError(status) {
  return status >= 400 && status < 500;
}

export function isServerError(status) {
  return status >= 500;
}

export function isRateLimited(status) {
  return status === STATUS_CODES.RATE_LIMITED;
}

// Reporting
export function logResult(testName, success, duration, details = {}) {
  const result = success ? '✓ PASS' : '✗ FAIL';
  const durationStr = `${duration.toFixed(2)}ms`;
  
  console.log(`${result} [${testName}] ${durationStr}`, JSON.stringify(details));
}

export function logThreshold(thresholdName, value, target) {
  const status = value <= target ? '✓' : '✗';
  console.log(`${status} ${thresholdName}: ${value.toFixed(2)}ms (target: ${target}ms)`);
}
