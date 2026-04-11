/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by stopping requests to failing services
 */

import { getResilienceLogger } from './logger.js';
import type { HttpError } from './retry.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  errorFilter?: (error: Error) => boolean;
  onStateChange?: (state: CircuitState) => void;
  onTrip?: () => void;
  onReset?: () => void;
}

export interface CircuitBreakerStats {
  [key: string]: unknown;
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  stateChangedAt: number;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  resetTimeout: 30000,
  volumeThreshold: 10,
  errorFilter: () => true,
  onStateChange: () => {
    // No-op default  -  consumers override via config
  },
  onTrip: () => {
    // No-op default  -  consumers override via config
  },
  onReset: () => {
    // No-op default  -  consumers override via config
  },
};

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private totalCalls: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private stateChangedAt: number = Date.now();
  private resetTimer?: NodeJS.Timeout;
  protected config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute function with circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      // Check if reset timeout has passed
      if (Date.now() - this.stateChangedAt >= this.config.resetTimeout) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      }
    }

    this.totalCalls++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onFailure(err);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.totalSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    if (this.state === 'half-open') {
      // Check if we can close the circuit
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }

    // Reset failure count in closed state
    if (this.state === 'closed') {
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    // Check if error should count
    if (!this.config.errorFilter(error)) {
      return;
    }

    this.failures++;
    this.consecutiveFailures++;
    this.totalFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Immediately open circuit on failure in half-open state
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      // Check if we should open the circuit
      if (
        this.consecutiveFailures >= this.config.failureThreshold &&
        this.totalCalls >= this.config.volumeThreshold
      ) {
        this.transitionTo('open');
      }
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.stateChangedAt = Date.now();

    // Reset counters
    if (newState === 'half-open' || newState === 'closed') {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
    }

    // Clear reset timer
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    // Set reset timer for open state
    if (newState === 'open') {
      this.resetTimer = setTimeout(() => {
        this.transitionTo('half-open');
      }, this.config.resetTimeout);

      this.config.onTrip();
    }

    // Circuit reset
    if (newState === 'closed' && oldState === 'half-open') {
      this.failures = 0;
      this.config.onReset();
    }

    this.config.onStateChange(newState);

    getResilienceLogger().info(
      `Circuit breaker state changed: ${oldState} -> ${newState}`,
      this.getStats(),
    );
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
    };
  }

  /**
   * Manually open circuit
   */
  trip(): void {
    this.transitionTo('open');
  }

  /**
   * Manually close circuit
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.transitionTo('closed');
  }

  /**
   * Force state to half-open
   */
  halfOpen(): void {
    this.transitionTo('half-open');
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.totalCalls === 0) return 0;
    return this.totalFailures / this.totalCalls;
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.totalCalls === 0) return 0;
    return this.totalSuccesses / this.totalCalls;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit breaker registry
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  get(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Check if breaker exists
   */
  has(name: string): boolean {
    return this.breakers.has(name);
  }

  /**
   * Remove circuit breaker
   */
  remove(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      return this.breakers.delete(name);
    }
    return false;
  }

  /**
   * Get all breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get all statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Clear all breakers
   */
  clear(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

/**
 * Global circuit breaker registry
 */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Create circuit breaker decorator
 */
export function CircuitBreak(nameOrConfig: string | CircuitBreakerConfig = {}) {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const name =
      typeof nameOrConfig === 'string'
        ? nameOrConfig
        : `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`;
    const config = typeof nameOrConfig === 'object' ? nameOrConfig : undefined;

    descriptor.value = async function (...args: unknown[]) {
      const breaker = circuitBreakerRegistry.get(name, config);
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Execute with circuit breaker
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: CircuitBreakerConfig,
): Promise<T> {
  const breaker = circuitBreakerRegistry.get(name, config);
  return breaker.execute(fn);
}

/**
 * Create circuit breaker middleware
 */
export function createCircuitBreakerMiddleware<TRequest = unknown, TResponse = unknown>(
  name: string,
  config?: CircuitBreakerConfig,
) {
  const breaker = circuitBreakerRegistry.get(name, config);

  return async (_request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> => {
    return breaker.execute(next);
  };
}

/**
 * Circuit breaker for fetch
 */
export async function fetchWithCircuitBreaker(
  name: string,
  url: string,
  init?: RequestInit,
  config?: CircuitBreakerConfig,
): Promise<Response> {
  const breaker = circuitBreakerRegistry.get(name, config);

  return breaker.execute(async () => {
    const response = await fetch(url, init);

    // Treat 5xx errors as failures
    if (response.status >= 500) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
      error.statusCode = response.status;
      throw error;
    }

    return response;
  });
}

/**
 * Adaptive circuit breaker with dynamic thresholds
 */
export class AdaptiveCircuitBreaker extends CircuitBreaker {
  private errorRateWindow: number[] = [];
  private windowSize: number = 100;
  private adaptiveThreshold: number;

  constructor(config: CircuitBreakerConfig = {}) {
    super(config);
    this.adaptiveThreshold = config.failureThreshold || 5;
  }

  /**
   * Execute with adaptive thresholds
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await super.execute(fn);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record success in window
   */
  private recordSuccess(): void {
    this.errorRateWindow.push(0);
    this.trimWindow();
    this.adjustThreshold();
  }

  /**
   * Record failure in window
   */
  private recordFailure(): void {
    this.errorRateWindow.push(1);
    this.trimWindow();
    this.adjustThreshold();
  }

  /**
   * Trim window to size
   */
  private trimWindow(): void {
    if (this.errorRateWindow.length > this.windowSize) {
      this.errorRateWindow.shift();
    }
  }

  /**
   * Adjust threshold based on error rate
   */
  private adjustThreshold(): void {
    const errorRate = this.getWindowErrorRate();

    // Increase threshold if error rate is low
    if (errorRate < 0.1) {
      this.adaptiveThreshold = Math.min(this.adaptiveThreshold + 1, 20);
    }
    // Decrease threshold if error rate is high
    else if (errorRate > 0.5) {
      this.adaptiveThreshold = Math.max(this.adaptiveThreshold - 1, 2);
    }

    // Sync adaptive threshold to parent config so it actually takes effect
    this.config.failureThreshold = this.adaptiveThreshold;
  }

  /**
   * Get error rate in window
   */
  private getWindowErrorRate(): number {
    if (this.errorRateWindow.length === 0) return 0;

    const errors = this.errorRateWindow.reduce((sum, val) => sum + val, 0);
    return errors / this.errorRateWindow.length;
  }

  /**
   * Get adaptive threshold
   */
  getAdaptiveThreshold(): number {
    return this.adaptiveThreshold;
  }
}

/**
 * Bulkhead pattern - limit concurrent executions
 */
export class Bulkhead {
  private activeRequests: number = 0;
  private queue: Array<() => void> = [];
  private maxConcurrent: number;
  private maxQueue: number;

  constructor(maxConcurrent: number = 10, maxQueue: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }

  /**
   * Execute with bulkhead
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if at capacity
    if (this.activeRequests >= this.maxConcurrent) {
      // Check queue capacity
      if (this.queue.length >= this.maxQueue) {
        throw new Error('Bulkhead queue is full');
      }

      // Wait for slot
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activeRequests++;

    try {
      return await fn();
    } finally {
      this.activeRequests--;

      // Process queue
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Get active requests
   */
  getActiveRequests(): number {
    return this.activeRequests;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeRequests: number;
    queueSize: number;
    maxConcurrent: number;
    maxQueue: number;
  } {
    return {
      activeRequests: this.activeRequests,
      queueSize: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    };
  }
}

/**
 * Combined resilience wrapper
 */
export class ResilientOperation<T> {
  constructor(
    private fn: () => Promise<T>,
    private circuitBreaker?: CircuitBreaker,
    private bulkhead?: Bulkhead,
  ) {}

  /**
   * Execute with all resilience patterns
   */
  async execute(): Promise<T> {
    const executeFn = async () => {
      if (this.bulkhead) {
        return this.bulkhead.execute(this.fn);
      }
      return this.fn();
    };

    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(executeFn);
    }

    return executeFn();
  }
}

/**
 * Create resilient function
 */
export function createResilientFunction<T>(
  fn: () => Promise<T>,
  options: {
    circuitBreaker?: CircuitBreakerConfig;
    bulkhead?: { maxConcurrent: number; maxQueue: number };
  } = {},
): () => Promise<T> {
  const breaker = options.circuitBreaker ? new CircuitBreaker(options.circuitBreaker) : undefined;

  const bulkhead = options.bulkhead
    ? new Bulkhead(options.bulkhead.maxConcurrent, options.bulkhead.maxQueue)
    : undefined;

  const operation = new ResilientOperation(fn, breaker, bulkhead);

  return () => operation.execute();
}
