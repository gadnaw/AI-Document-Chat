/**
 * k6 Load Testing Scripts for AI Document Chat
 * Tests document processing, query latency, and throughput
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const documentProcessingTime = new Trend('document_processing_time');
const queryLatency = new Trend('query_latency');
const throughput = new Trend('throughput');
const errorRate = new Rate('error_rate');
const successfulUploads = new Counter('successful_uploads');
const failedUploads = new Counter('failed_uploads');

// Configuration
export const options = {
  // Smoke test - quick validation
  smokeTest: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    thresholds: {
      http_req_duration: ['p(95)<1000'],
      error_rate: ['rate<0.01'],
    },
  },
  
  // Load test - realistic traffic
  loadTest: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 10 },  // Ramp up
      { duration: '5m', target: 10 },  // Steady state
      { duration: '2m', target: 20 },  // Increase load
      { duration: '5m', target: 20 },  // Higher steady state
      { duration: '2m', target: 0 },  // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000', 'p(99)<5000'],
      error_rate: ['rate<0.01'],
      document_processing_time: ['p(95)<30000'],
      query_latency: ['p(95)<2000'],
    },
  },
  
  // Stress test - find breaking point
  stressTest: {
    executor: 'ramping-vus',
    stages: [
      { duration: '2m', target: 10 },
      { duration: '5m', target: 30 },
      { duration: '5m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      error_rate: ['rate<0.05'],  // Allow more errors during stress
      throughput: ['min>10'],
    },
  },
  
  // Soak test - long duration stability
  soakTest: {
    executor: 'constant-vus',
    vus: 20,
    duration: '60m',
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      error_rate: ['rate<0.02'],
      memory: ['max<100'],  // Check for memory leaks
    },
  },
  
  // Performance test - specific SLA validation
  performanceTest: {
    executor: 'constant-arrival-rate',
    rate: 5,
    timeUnit: '1s',
    duration: '10m',
    preAllocatedVUs: 10,
    maxVUs: 50,
    thresholds: {
      query_latency: ['p(95)<2000', 'p(99)<5000'],
      error_rate: ['rate<0.01'],
    },
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const TEST_DOC_PATH = __ENV.TEST_DOC_PATH || './test-doc.pdf';
const CONCURRENT_USERS = parseInt(__ENV.CONCURRENT_USERS) || 10;

// Default thresholds from RESEARCH.md
const THRESHOLDS = {
  DOCUMENT_PROCESSING: 30000,  // 30 seconds
  QUERY_LATENCY_P95: 2000,     // 2 seconds
  ERROR_RATE: 0.01,            // 1%
};

/**
 * Test Scenario A: Document Processing Throughput
 * Measures time to process uploaded documents
 */
export function testDocumentProcessing() {
  const testFileName = `test-document-${randomString(8)}.pdf`;
  
  // Prepare multipart form data
  const file = open(TEST_DOC_PATH);
  const payload = {
    file: http.file(file, testFileName, 'application/pdf'),
  };
  
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
  
  const startTime = Date.now();
  
  // Upload document
  const response = http.post(`${BASE_URL}/api/upload`, payload, {
    headers,
  });
  
  const processingTime = Date.now() - startTime;
  documentProcessingTime.add(processingTime);
  
  // Check result
  const success = check(response, {
    'upload successful': (r) => r.status === 200 || r.status === 201,
    'upload completes within SLA': () => processingTime < THRESHOLDS.DOCUMENT_PROCESSING,
  });
  
  if (success) {
    successfulUploads.add(1);
  } else {
    failedUploads.add(1);
    errorRate.add(1);
  }
  
  // Wait between uploads
  sleep(randomIntBetween(2, 5));
}

/**
 * Test Scenario B: Query Latency
 * Measures end-to-end query response time
 */
export function testQueryLatency() {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };
  
  const payload = JSON.stringify({
    message: 'What are the key findings in this document?',
    conversationId: null,
  });
  
  const startTime = Date.now();
  
  // Send query
  const response = http.post(`${BASE_URL}/api/chat`, payload, { headers });
  
  const latency = Date.now() - startTime;
  queryLatency.add(latency);
  throughput.add(1);
  
  // Check result
  const success = check(response, {
    'query completed': (r) => r.status >= 200 && r.status < 400,
    'query within SLA': () => latency < THRESHOLDS.QUERY_LATENCY_P95,
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  // Brief pause between queries
  sleep(randomIntBetween(1, 3));
}

/**
 * Test Scenario C: Throughput Test
 * Measures requests per second capacity
 */
export function testThroughput() {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
  
  // Make rapid requests
  const batchSize = 5;
  const startTime = Date.now();
  
  const responses = [];
  for (let i = 0; i < batchSize; i++) {
    const response = http.get(`${BASE_URL}/api/health`, { headers });
    responses.push(response);
  }
  
  const totalTime = Date.now() - startTime;
  const requestsPerSecond = (batchSize / totalTime) * 1000;
  
  throughput.add(requestsPerSecond);
  
  // Check all requests succeeded
  const allSuccess = responses.every(r => r.status < 400);
  if (!allSuccess) {
    errorRate.add(1);
  }
}

/**
 * Test Scenario D: Streaming Response Test
 * Verifies streaming starts within SLA
 */
export function testStreamingResponse() {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };
  
  const payload = JSON.stringify({
    message: 'Explain the methodology in detail',
    stream: true,
  });
  
  const startTime = Date.now();
  
  // Send streaming request
  const response = http.post(`${BASE_URL}/api/chat`, payload, { headers });
  
  const timeToFirstByte = response.timings.waiting;
  
  check(response, {
    'streaming initiated': (r) => r.status >= 200 && r.status < 400,
    'first byte within 500ms': () => timeToFirstByte < 500,
  });
  
  sleep(randomIntBetween(2, 4));
}

/**
 * Test Scenario E: Concurrent User Load
 * Simulates multiple users interacting simultaneously
 */
export function testConcurrentUsers() {
  const userId = `test-user-${randomIntBetween(1, CONCURRENT_USERS)}`;
  
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'X-User-ID': userId,
    'Content-Type': 'application/json',
  };
  
  // Simulate user session
  const sessionResponse = http.get(`${BASE_URL}/api/conversations`, { headers });
  
  if (sessionResponse.status === 200) {
    // User has active session, send a query
    const queryPayload = JSON.stringify({
      message: 'Summarize the document',
      conversationId: null,
    });
    
    const queryStart = Date.now();
    const queryResponse = http.post(`${BASE_URL}/api/chat`, queryPayload, { headers });
    const queryTime = queryResponse.timings.duration;
    
    check(queryResponse, {
      'user query successful': (r) => r.status >= 200 && r.status < 400,
      'query response time acceptable': () => queryTime < 5000,
    });
  } else {
    errorRate.add(1);
  }
  
  sleep(randomIntBetween(1, 2));
}

/**
 * Test Scenario F: Search Performance
 * Tests similarity search endpoint performance
 */
export function testSearchPerformance() {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };
  
  const payload = JSON.stringify({
    query: 'artificial intelligence machine learning',
    limit: 5,
    threshold: 0.7,
  });
  
  const startTime = Date.now();
  
  const response = http.post(`${BASE_URL}/api/search`, payload, { headers });
  
  const searchTime = Date.now() - startTime;
  
  check(response, {
    'search completed': (r) => r.status >= 200 && r.status < 400,
    'search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results && body.results.length > 0;
      } catch {
        return false;
      }
    },
    'search within SLA': () => searchTime < 2000,
  });
}

/**
 * Main test scenarios
 */
export default function () {
  // Run different tests based on scenario
  const scenario = __ENV.SCENARIO || 'load';
  
  switch (scenario) {
    case 'document':
      testDocumentProcessing();
      break;
    case 'query':
      testQueryLatency();
      break;
    case 'throughput':
      testThroughput();
      break;
    case 'streaming':
      testStreamingResponse();
      break;
    case 'concurrent':
      testConcurrentUsers();
      break;
    case 'search':
      testSearchPerformance();
      break;
    default:
      // Run mixed workload
      const rand = Math.random();
      if (rand < 0.3) {
        testQueryLatency();
      } else if (rand < 0.5) {
        testSearchPerformance();
      } else if (rand < 0.7) {
        testThroughput();
      } else {
        testConcurrentUsers();
      }
  }
}

/**
 * Setup function - runs once at the start
 */
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  console.log(`Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`Test scenario: ${__ENV.SCENARIO || 'mixed'}`);
  
  return {
    baseUrl: BASE_URL,
    authToken: AUTH_TOKEN,
  };
}

/**
 * Teardown function - runs once at the end
 */
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Document processing time (p95): ${documentProcessingTime.values.p95}ms`);
  console.log(`Query latency (p95): ${queryLatency.values.p95}ms`);
  console.log(`Error rate: ${(errorRate.values.rate * 100).toFixed(2)}%`);
  
  // Generate summary
  const summary = {
    documentProcessing: {
      p50: documentProcessingTime.values.p50,
      p95: documentProcessingTime.values.p95,
      p99: documentProcessingTime.values.p99,
    },
    queryLatency: {
      p50: queryLatency.values.p50,
      p95: queryLatency.values.p95,
      p99: queryLatency.values.p99,
    },
    throughput: {
      avg: throughput.values.avg,
      min: throughput.values.min,
      max: throughput.values.max,
    },
    errorRate: errorRate.values.rate,
  };
  
  console.log('Summary:', JSON.stringify(summary, null, 2));
}
