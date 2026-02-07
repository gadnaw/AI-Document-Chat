/**
 * Circuit Breaker Pattern Implementation
 * 
 * Provides resilience for external service calls by preventing cascading failures.
 * When a service fails repeatedly, the circuit breaker "opens" and fails fast
 * instead of continuing to make requests that will likely fail.
 * 
 * States:
 * - CLOSED: Normal operation, requests execute
 * - OPEN: Failure threshold exceeded, requests fail immediately without executing
 * - HALF_OPEN: Testing recovery, allows limited requests through
 */

import { captureServerMessage, setSentryContext } from '../../sentry.server.config';

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker Events
 */
export enum CircuitEvent {
  SUCCESS = 'success',
  FAILURE = 'failure',
  TIMEOUT = 'timeout',
  CIRCUIT_OPEN = 'circuit_open',
  CIRCUIT_CLOSED = 'circuit_closed',
  CIRCUIT_HALF_OPEN = 'circuit_half_open',
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold: number;
  /** Number of successes needed to close the circuit in HALF_OPEN state (default: 2) */
  successThreshold: number;
  /** Time in milliseconds before trying again after opening (default: 30000ms = 30s) */
  timeout: number;
  /** Minimum number of requests before evaluating state (default: 10) */
  volumeThreshold: number;
  /** Time window for counting failures (default: 60000ms = 1min) */
  windowSize: number;
  /** Half-open request limit (default: 3) */
  halfOpenLimit: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  volumeThreshold: 10,
  windowSize: 60000,
  halfOpenLimit: 3,
};

/**
 * Circuit Breaker Metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  requestCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  averageResponseTime: number;
}

/**
 * Circuit Breaker Instance
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private failureCount: number = 0;
  private successCount: number = 0;
  private requestCount: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private lastStateChange: number = Date.now();
  private halfOpenRequests: number = 0;
  private failures: number[] = []; // Timestamps of failures
  private successes: number[] = []; // Timestamps of successes
  private responseTimes: number[] = []; // Response times for monitoring
  private name: string;
  private eventListeners: Map<CircuitEvent, ((data: any) => void)[]> = new Map();

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = CircuitState.CLOSED;
    
    // Initialize event listeners
    Object.values(CircuitEvent).forEach(event => {
      this.eventListeners.set(event, []);
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed to try HALF_OPEN
      if (Date.now() - this.lastStateChange >= this.config.timeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        // Circuit is open, reject immediately
        this.emit(CircuitEvent.CIRCUIT_OPEN, { service: this.name });
        
        if (fallback) {
          return fallback();
        }
        
        throw new CircuitOpenError(
          `Circuit breaker '${this.name}' is OPEN. Requests are being rejected.`,
          this.name,
          this.getMetrics()
        );
      }
    }

    // Execute the operation
    try {
      const result = await operation();
      this.recordSuccess(Date.now() - startTime);
      this.emit(CircuitEvent.SUCCESS, { service: this.name, duration: Date.now() - startTime });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(duration);
      this.emit(CircuitEvent.FAILURE, { 
        service: this.name, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      });
      
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(duration: number): void {
    this.successCount++;
    this.requestCount++;
    this.lastSuccessTime = Date.now();
    this.successes.push(Date.now());
    this.responseTimes.push(duration);
    
    // Clean up old records
    this.cleanup();
    
    // If in HALF_OPEN state, check if we should close
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      } else if (this.halfOpenRequests >= this.config.halfOpenLimit) {
        // Too many failures in HALF_OPEN, go back to OPEN
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(duration: number): void {
    this.failureCount++;
    this.requestCount++;
    this.lastFailureTime = Date.now();
    this.failures.push(Date.now());
    this.responseTimes.push(duration);
    
    // Clean up old records
    this.cleanup();
    
    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED) {
      // Only open if we have enough volume
      if (this.requestCount >= this.config.volumeThreshold) {
        const recentFailures = this.failures.filter(
          f => Date.now() - f < this.config.windowSize
        ).length;
        
        if (recentFailures >= this.config.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
        }
      }
    }
    
    // If in HALF_OPEN, any failure opens the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    // Reset counters based on transition
    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenRequests = 0;
      this.successCount = 0;
      this.failureCount = 0;
      this.emit(CircuitEvent.CIRCUIT_HALF_OPEN, { 
        service: this.name, 
        previousState: oldState 
      });
    } else if (newState === CircuitState.CLOSED) {
      // Reset counters but keep history for metrics
      this.successCount = 0;
      this.failureCount = 0;
      this.halfOpenRequests = 0;
      this.emit(CircuitEvent.CIRCUIT_CLOSED, { 
        service: this.name, 
        previousState: oldState 
      });
    } else if (newState === CircuitState.OPEN) {
      this.halfOpenRequests = 0;
      this.emit(CircuitEvent.CIRCUIT_OPEN, { 
        service: this.name, 
        previousState: oldState,
        failureCount: this.failureCount
      });
    }
    
    // Capture event in Sentry for monitoring
    captureServerMessage(
      `Circuit breaker '${this.name}' state change: ${oldState} -> ${newState}`,
      'info',
      {
        service: this.name,
        oldState,
        newState,
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Clean up old records
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;
    
    this.failures = this.failures.filter(f => f >= windowStart);
    this.successes = this.successes.filter(s => s >= windowStart);
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const recentFailures = this.failures.filter(
      f => Date.now() - f < this.config.windowSize
    ).length;
    
    const recentSuccesses = this.successes.filter(
      s => Date.now() - s < this.config.windowSize
    ).length;
    
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return {
      state: this.state,
      failureCount: recentFailures,
      successCount: recentSuccesses,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.requestCount,
      totalFailures: this.failureCount,
      totalSuccesses: this.successCount,
      averageResponseTime: avgResponseTime,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get state description
   */
  getStatus(): {
    state: CircuitState;
    message: string;
    metrics: CircuitBreakerMetrics;
  } {
    const metrics = this.getMetrics();
    let message: string;

    switch (this.state) {
      case CircuitState.CLOSED:
        message = `Normal operation. ${metrics.successCount} successes, ${metrics.failureCount} failures in window.`;
        break;
      case CircuitState.OPEN:
        const timeUntilRetry = Math.max(0, this.config.timeout - (Date.now() - this.lastStateChange));
        message = `Circuit open. Failing fast. Retry in ${Math.round(timeUntilRetry / 1000)}s.`;
        break;
      case CircuitState.HALF_OPEN:
        message = `Testing recovery. ${metrics.successCount}/${this.config.successThreshold} successes needed.`;
        break;
      default:
        message = 'Unknown state';
    }

    return { state: this.state, message, metrics };
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.lastStateChange = Date.now();
    this.halfOpenRequests = 0;
    this.failures = [];
    this.successes = [];
    this.responseTimes = [];
    
    captureServerMessage(
      `Circuit breaker '${this.name}' was manually reset`,
      'info',
      { service: this.name }
    );
  }

  /**
   * Force open the circuit
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Force close the circuit
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Add event listener
   */
  on(event: CircuitEvent, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Remove event listener
   */
  off(event: CircuitEvent, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    this.eventListeners.set(event, listeners);
  }

  /**
   * Emit event to  private emit(event listeners
   */
: CircuitEvent, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => callback(data));
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  serviceName: string;
  metrics: CircuitBreakerMetrics;

  constructor(
    message: string,
    serviceName: string,
    metrics: CircuitBreakerMetrics
  ) {
    super(message);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.metrics = metrics;
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers by name
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStatus(): Record<string, { state: CircuitState; message: string; metrics: CircuitBreakerMetrics }> {
    const status: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      status[name] = breaker.getStatus();
    });
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

// Singleton instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Common circuit breaker instances
 */

// OpenAI/LLM Service Breaker
export const openAICircuitBreaker = circuitBreakerRegistry.get('openai', {
  failureThreshold: 3, // More sensitive for external API
  successThreshold: 2,
  timeout: 60000, // 1 minute timeout
  volumeThreshold: 5,
  windowSize: 30000, // 30 second window
});

// Supabase/Database Breaker
export const supabaseCircuitBreaker = circuitBreakerRegistry.get('supabase', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  volumeThreshold: 10,
  windowSize: 60000,
});

// Redis/Cache Breaker
export const redisCircuitBreaker = circuitBreakerRegistry.get('redis', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 10000, // Shorter timeout for cache
  volumeThreshold: 10,
  windowSize: 60000,
});

/**
 * Execute with OpenAI circuit breaker protection
 */
export async function executeWithOpenAI<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return openAICircuitBreaker.execute(operation, fallback);
}

/**
 * Execute with Supabase circuit breaker protection
 */
export async function executeWithSupabase<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return supabaseCircuitBreaker.execute(operation, fallback);
}

/**
 * Execute with Redis circuit breaker protection
 */
export async function executeWithRedis<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return redisCircuitBreaker.execute(operation, fallback);
}

/**
 * Generic circuit breaker execution helper
 */
export async function executeWithBreaker<T>(
  breaker: CircuitBreaker,
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  return breaker.execute(operation, fallback);
}
