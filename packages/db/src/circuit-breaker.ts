/**
 * Jubilee Square v2 — Resilient Circuit Breaker
 *
 * Implements standard 3-state Circuit Breaker pattern (CLOSED -> OPEN -> HALF_OPEN).
 * Protects catalog-api and db consumers against database connection outages,
 * query timeouts, and external CMS network partitions.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerOpenError extends Error {
  constructor(message: string = 'Circuit breaker is OPEN') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface CircuitBreakerOptions {
  name?: string;
  failureThreshold?: number; // Number of consecutive failures before opening circuit
  resetTimeoutMs?: number;   // Milliseconds to wait before attempting recovery in HALF_OPEN
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  totalFallbacks: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastStateChange: number;
}

export class CircuitBreaker {
  private name: string;
  private state: CircuitState = 'CLOSED';
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalFallbacks = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private lastStateChange: number = Date.now();
  private onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 5000;
    this.onStateChange = options.onStateChange;
  }

  getState(): CircuitState {
    // Check if OPEN cooldown has elapsed, transitioning to HALF_OPEN
    if (this.state === 'OPEN' && this.lastFailureTime) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  getName(): string {
    return this.name;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      name: this.name,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalFallbacks: this.totalFallbacks,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
    };
  }

  async execute<T>(
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    const currentState = this.getState();

    // In OPEN state, fast-fail directly to fallback or throw
    if (currentState === 'OPEN') {
      if (fallbackFn) {
        this.totalFallbacks++;
        return fallbackFn();
      }
      throw new CircuitBreakerOpenError(`Circuit breaker [${this.name}] is OPEN`);
    }

    try {
      const result = await primaryFn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (fallbackFn) {
        this.totalFallbacks++;
        return fallbackFn();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED');
    }
  }

  private onFailure(err: unknown): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (this.onStateChange) {
      try {
        this.onStateChange(oldState, newState, this.name);
      } catch {}
    }
  }

  reset(): void {
    const oldState = this.state;
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastStateChange = Date.now();
    if (oldState !== 'CLOSED' && this.onStateChange) {
      this.onStateChange(oldState, 'CLOSED', this.name);
    }
  }

  trip(): void {
    this.lastFailureTime = Date.now();
    this.transitionTo('OPEN');
  }
}
