# @revealui/resilience

Resilience infrastructure for RevealUI applications. Implements circuit breaker, retry with exponential backoff, and bulkhead patterns for fault-tolerant service communication.

## When to Use This

- You're calling external APIs (Stripe, Supabase, AI providers) and need fault tolerance
- You want automatic retry with backoff for transient failures
- You need circuit breakers to prevent cascading failures across services

If your code only talks to the local database via Drizzle, you don't need this  -  Drizzle handles connection pooling internally.

## Installation

```bash
pnpm add @revealui/resilience
```

Zero runtime dependencies.

## API Reference

### Circuit Breaker

| Export | Type | Purpose |
|--------|------|---------|
| `CircuitBreaker` | Class | Basic circuit breaker (closed/open/half-open states) |
| `AdaptiveCircuitBreaker` | Class | Self-tuning thresholds based on error rate |
| `Bulkhead` | Class | Concurrency limiter to isolate resource pools |
| `CircuitBreakerRegistry` | Class | Named registry for managing multiple breakers |
| `CircuitBreak` | Decorator | Apply circuit breaker to class methods |
| `createCircuitBreakerMiddleware` | Function | Hono middleware for route-level protection |
| `fetchWithCircuitBreaker` | Function | Fetch wrapper with automatic circuit breaking |
| `withCircuitBreaker` | Function | Wrap any async function with a circuit breaker |
| `createResilientFunction` | Function | Combine circuit breaker + retry in one wrapper |
| `ResilientOperation` | Class | Composable resilience pipeline |

### Retry

| Export | Type | Purpose |
|--------|------|---------|
| `retry` | Function | Retry an async operation with configurable policy |
| `retryBatch` | Function | Retry multiple operations with shared policy |
| `retryIf` | Function | Retry only when predicate matches the error |
| `retryUntil` | Function | Retry until success condition is met |
| `retryWithFallback` | Function | Retry with fallback value on exhaustion |
| `ExponentialBackoff` | Class | Configurable backoff calculator |
| `RetryPolicies` | Object | Pre-built policies (aggressive, conservative, network) |
| `RetryPolicyBuilder` | Class | Fluent API for building custom retry policies |
| `Retryable` | Decorator | Apply retry to class methods |
| `RetryableOperation` | Class | Stateful retry with event hooks |
| `createRetryMiddleware` | Function | Hono middleware for automatic request retry |
| `fetchWithRetry` | Function | Fetch wrapper with retry |

### Configuration

| Export | Type | Purpose |
|--------|------|---------|
| `configureResilienceLogger` | Function | Set custom logger (defaults to console) |
| `globalRetryConfig` | Object | Global retry defaults |

## Usage

```typescript
import { retry, CircuitBreaker, RetryPolicies } from '@revealui/resilience';

// Simple retry
const result = await retry(() => fetch('https://api.stripe.com/...'), {
  maxRetries: 3,
  baseDelay: 1000,
});

// Circuit breaker for external service
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 });
const data = await breaker.execute(() => callExternalAPI());
```

## JOSHUA Alignment

- **Hermetic**: Isolates failure domains  -  one service's outage doesn't cascade to others
- **Adaptive**: Self-tuning circuit breakers adjust thresholds based on observed error rates
- **Orthogonal**: Resilience patterns are composable and independent of business logic

## Related Packages

- `@revealui/core`  -  Uses resilience patterns for CMS API calls
- `apps/api`  -  Applies circuit breakers to external service routes
