  # Error Handling & Recovery

Comprehensive error handling infrastructure for building resilient production applications.

## Features

- **React Error Boundaries** - Catch and handle React component errors gracefully
- **Retry Logic** - Exponential backoff retry with configurable policies
- **Circuit Breakers** - Prevent cascading failures by stopping requests to failing services
- **Fallback UI** - Pre-built fallback components for error states
- **Error Reporting** - Integrate with error tracking services (Sentry, Bugsnag, etc.)
- **Automatic Recovery** - Self-healing mechanisms for transient failures

## Installation

```bash
pnpm add @revealui/core
```

## Quick Start

### React Error Boundary

```tsx
import { ErrorBoundary } from '@revealui/core/error-handling'

function App() {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong</div>}
      onError={(error, errorInfo) => {
        console.error('Error caught:', error, errorInfo)
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  )
}
```

### Retry API Calls

```typescript
import { retry, RetryPolicies } from '@revealui/core/error-handling'

const data = await retry(
  async () => {
    const response = await fetch('/api/users')
    return response.json()
  },
  RetryPolicies.default()
)
```

### Circuit Breaker

```typescript
import { withCircuitBreaker } from '@revealui/core/error-handling'

const fetchUser = async (id: string) => {
  return withCircuitBreaker(
    'user-service',
    async () => {
      const response = await fetch(`/api/users/${id}`)
      return response.json()
    },
    {
      failureThreshold: 5,
      resetTimeout: 30000,
    }
  )
}
```

## Error Boundaries

### Basic Error Boundary

```tsx
import { ErrorBoundary } from '@revealui/core/error-handling'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### With Custom Fallback

```tsx
<ErrorBoundary
  fallback={(error, errorInfo) => (
    <div>
      <h1>Oops! Something went wrong</h1>
      <p>{error.message}</p>
    </div>
  )}
>
  <YourComponent />
</ErrorBoundary>
```

### With Retry

```tsx
<ErrorBoundaryWithRetry
  maxRetries={3}
  retryDelay={1000}
>
  <YourComponent />
</ErrorBoundaryWithRetry>
```

### Isolated Error Boundary

Use `isolate` mode for non-critical components to prevent full page errors:

```tsx
<ErrorBoundary isolate>
  <NonCriticalWidget />
</ErrorBoundary>
```

### Reset on Key Change

Automatically reset error boundary when specific values change:

```tsx
<ErrorBoundary resetKeys={[userId, routePath]}>
  <UserProfile userId={userId} />
</ErrorBoundary>
```

### HOC Pattern

```tsx
import { withErrorBoundary } from '@revealui/core/error-handling'

const SafeComponent = withErrorBoundary(MyComponent, {
  fallback: <div>Error loading component</div>,
  onError: (error) => console.error(error)
})
```

### Hook Pattern

```tsx
import { useErrorHandler } from '@revealui/core/error-handling'

function MyComponent() {
  const handleError = useErrorHandler()

  const handleClick = async () => {
    try {
      await riskyOperation()
    } catch (error) {
      handleError(error) // Will trigger error boundary
    }
  }

  return <button onClick={handleClick}>Click</button>
}
```

## Retry Logic

### Basic Retry

```typescript
import { retry } from '@revealui/core/error-handling'

const result = await retry(
  async () => {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error('Request failed')
    return response.json()
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    jitter: true,
  }
)
```

### Fetch with Retry

```typescript
import { fetchWithRetry } from '@revealui/core/error-handling'

const response = await fetchWithRetry(
  '/api/users',
  {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  },
  {
    maxRetries: 3,
    baseDelay: 1000
  }
)
```

### Retry Policies

Pre-configured retry policies for common scenarios:

```typescript
import { retry, RetryPolicies } from '@revealui/core/error-handling'

// Default policy (3 retries, exponential backoff)
await retry(fn, RetryPolicies.default())

// Aggressive policy (5 retries, faster backoff)
await retry(fn, RetryPolicies.aggressive())

// Conservative policy (2 retries, longer backoff)
await retry(fn, RetryPolicies.conservative())

// Network errors only
await retry(fn, RetryPolicies.networkOnly())

// Idempotent operations (safe to retry)
await retry(fn, RetryPolicies.idempotent())
```

### Retry Policy Builder

```typescript
import { RetryPolicyBuilder } from '@revealui/core/error-handling'

const policy = new RetryPolicyBuilder()
  .maxRetries(5)
  .baseDelay(500)
  .maxDelay(10000)
  .exponentialBackoff(true)
  .jitter(true)
  .retryOn((error) => error.name === 'NetworkError')
  .onRetry((error, attempt) => {
    console.log(`Retry attempt ${attempt}:`, error)
  })
  .build()

await retry(fn, policy)
```

### Conditional Retry

```typescript
import { retryIf } from '@revealui/core/error-handling'

await retryIf(
  fetchData,
  (error, attempt) => {
    // Only retry network errors and max 3 attempts
    return error.name === 'NetworkError' && attempt < 3
  }
)
```

### Retry Until Condition

```typescript
import { retryUntil } from '@revealui/core/error-handling'

const job = await retryUntil(
  async () => fetchJobStatus(jobId),
  (status) => status.state === 'completed',
  { baseDelay: 2000 },
  10 // max attempts
)
```

### Retry with Fallback

```typescript
import { retryWithFallback } from '@revealui/core/error-handling'

const data = await retryWithFallback(
  // Primary data source
  async () => fetchFromAPI(),
  // Fallback data source
  async () => fetchFromCache(),
  { maxRetries: 3 }
)
```

### Batch Retry

```typescript
import { retryBatch } from '@revealui/core/error-handling'

const results = await retryBatch([
  () => fetchUser(1),
  () => fetchUser(2),
  () => fetchUser(3),
], { maxRetries: 2 })

// Results include both successes and errors
results.forEach((result, index) => {
  if (result instanceof Error) {
    console.error(`Operation ${index} failed:`, result)
  } else {
    console.log(`Operation ${index} succeeded:`, result)
  }
})
```

### Decorator Pattern

```typescript
import { Retryable } from '@revealui/core/error-handling'

class APIClient {
  @Retryable({ maxRetries: 3, baseDelay: 1000 })
  async fetchUsers() {
    const response = await fetch('/api/users')
    return response.json()
  }
}
```

## Circuit Breakers

### Basic Circuit Breaker

```typescript
import { CircuitBreaker } from '@revealui/core/error-handling'

const breaker = new CircuitBreaker({
  failureThreshold: 5,    // Open after 5 failures
  successThreshold: 2,     // Close after 2 successes in half-open
  timeout: 60000,          // Open state timeout
  resetTimeout: 30000,     // Time before trying half-open
  volumeThreshold: 10,     // Minimum calls before opening
})

try {
  const result = await breaker.execute(async () => {
    return await fetch('/api/data').then(r => r.json())
  })
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log('Circuit breaker is open')
  }
}
```

### Circuit Breaker States

- **Closed** - Normal operation, requests pass through
- **Open** - Circuit is tripped, requests fail immediately
- **Half-Open** - Testing if service recovered, limited requests allowed

```typescript
const breaker = new CircuitBreaker()

breaker.isClosed()    // true
breaker.isOpen()      // false
breaker.isHalfOpen()  // false

breaker.getState()    // 'closed' | 'open' | 'half-open'
```

### Circuit Breaker Statistics

```typescript
const stats = breaker.getStats()

console.log({
  state: stats.state,
  failures: stats.failures,
  successes: stats.successes,
  consecutiveFailures: stats.consecutiveFailures,
  totalCalls: stats.totalCalls,
  failureRate: breaker.getFailureRate(),
  successRate: breaker.getSuccessRate(),
})
```

### Manual Control

```typescript
// Manually open circuit
breaker.trip()

// Manually close circuit
breaker.reset()

// Force half-open state
breaker.halfOpen()
```

### Circuit Breaker Registry

Manage multiple circuit breakers:

```typescript
import { circuitBreakerRegistry } from '@revealui/core/error-handling'

// Get or create circuit breaker
const userBreaker = circuitBreakerRegistry.get('user-service', {
  failureThreshold: 5,
})

const orderBreaker = circuitBreakerRegistry.get('order-service', {
  failureThreshold: 3,
})

// Get all statistics
const allStats = circuitBreakerRegistry.getAllStats()

// Reset all breakers
circuitBreakerRegistry.resetAll()

// Clear registry
circuitBreakerRegistry.clear()
```

### Circuit Breaker Decorator

```typescript
import { CircuitBreak } from '@revealui/core/error-handling'

class APIClient {
  @CircuitBreak('payment-service')
  async processPayment(amount: number) {
    return await fetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ amount })
    })
  }
}
```

### Fetch with Circuit Breaker

```typescript
import { fetchWithCircuitBreaker } from '@revealui/core/error-handling'

const response = await fetchWithCircuitBreaker(
  'api-service',
  '/api/users',
  { method: 'GET' },
  { failureThreshold: 5 }
)
```

### Adaptive Circuit Breaker

Automatically adjusts thresholds based on error rate:

```typescript
import { AdaptiveCircuitBreaker } from '@revealui/core/error-handling'

const breaker = new AdaptiveCircuitBreaker({
  failureThreshold: 5,
})

// Threshold adapts based on historical error rates
const result = await breaker.execute(async () => {
  return await fetchData()
})
```

### Bulkhead Pattern

Limit concurrent executions to prevent resource exhaustion:

```typescript
import { Bulkhead } from '@revealui/core/error-handling'

const bulkhead = new Bulkhead(
  10,   // Max concurrent executions
  100   // Max queue size
)

await bulkhead.execute(async () => {
  return await expensiveOperation()
})

// Get stats
const stats = bulkhead.getStats()
console.log({
  activeRequests: stats.activeRequests,
  queueSize: stats.queueSize,
})
```

### Combined Resilience

```typescript
import { createResilientFunction } from '@revealui/core/error-handling'

const resilientFetch = createResilientFunction(
  async () => fetch('/api/data').then(r => r.json()),
  {
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 30000,
    },
    bulkhead: {
      maxConcurrent: 10,
      maxQueue: 100,
    },
  }
)

const data = await resilientFetch()
```

## Fallback UI Components

### Error Fallback

```tsx
import { ErrorFallback } from '@revealui/core/error-handling'

<ErrorFallback
  error={error}
  onRetry={() => refetch()}
  title="Something went wrong"
  message="We couldn't load your data"
  showDetails={true}
/>
```

### Network Error Fallback

```tsx
import { NetworkErrorFallback } from '@revealui/core/error-handling'

<NetworkErrorFallback
  onRetry={() => refetch()}
  message="Check your internet connection"
/>
```

### Not Found Fallback

```tsx
import { NotFoundFallback } from '@revealui/core/error-handling'

<NotFoundFallback
  title="Page Not Found"
  message="The page you're looking for doesn't exist"
  onGoHome={() => navigate('/')}
/>
```

### Loading Fallback

```tsx
import { LoadingFallback } from '@revealui/core/error-handling'

<LoadingFallback
  message="Loading your data..."
  timeout={10000}
  onTimeout={() => console.log('Loading timed out')}
/>
```

### Offline Fallback

```tsx
import { OfflineFallback } from '@revealui/core/error-handling'

<OfflineFallback message="You're offline">
  <YourComponent />
</OfflineFallback>
```

### Degraded Service Fallback

```tsx
import { DegradedServiceFallback } from '@revealui/core/error-handling'

<DegradedServiceFallback
  serviceName="Payment Service"
  message="Some features are temporarily unavailable"
>
  <YourComponent />
</DegradedServiceFallback>
```

### Maintenance Fallback

```tsx
import { MaintenanceFallback } from '@revealui/core/error-handling'

<MaintenanceFallback
  title="Under Maintenance"
  message="We'll be back soon!"
  estimatedTime="30 minutes"
/>
```

### Permission Denied

```tsx
import { PermissionDeniedFallback } from '@revealui/core/error-handling'

<PermissionDeniedFallback
  message="You don't have access to this resource"
  onRequestAccess={() => requestAccess()}
  onGoBack={() => navigate(-1)}
/>
```

### Inline Error

```tsx
import { InlineError } from '@revealui/core/error-handling'

<InlineError
  message="Failed to save changes"
  onDismiss={() => clearError()}
/>
```

### Toast Notifications

```tsx
import { Toast } from '@revealui/core/error-handling'

<Toast
  type="error"
  message="Failed to delete item"
  duration={5000}
  onDismiss={() => closeToast()}
/>
```

### Skeleton Loader

```tsx
import { Skeleton } from '@revealui/core/error-handling'

<Skeleton width="200px" height="20px" borderRadius="4px" />
```

## Error Reporting

### Initialize Error Reporting

```typescript
import { initializeErrorReporting } from '@revealui/core/error-handling'

initializeErrorReporting({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  sampleRate: 0.1, // Sample 10% of errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ],
})
```

### Capture Errors

```typescript
import { errorReporter } from '@revealui/core/error-handling'

try {
  await riskyOperation()
} catch (error) {
  errorReporter.captureError(error, {
    level: 'error',
    tags: {
      feature: 'checkout',
      action: 'payment',
    },
    extra: {
      userId: currentUser.id,
      amount: orderTotal,
    },
  })
}
```

### Set User Context

```typescript
errorReporter.setUser({
  id: '123',
  email: 'user@example.com',
  username: 'johndoe',
})

// Clear user context
errorReporter.setUser(null)
```

### Add Breadcrumbs

```typescript
import { trackAction, trackNavigation, trackAPICall } from '@revealui/core/error-handling'

// Track user actions
trackAction('button_clicked', {
  buttonId: 'submit-form',
  page: '/checkout',
})

// Track navigation
trackNavigation('/products', '/checkout')

// Track API calls
trackAPICall('POST', '/api/orders', 201, 450)
```

### Custom Reporters

```typescript
import { errorReporter, HTTPErrorReporter } from '@revealui/core/error-handling'

// Add custom HTTP reporter
errorReporter.addReporter(
  new HTTPErrorReporter('https://your-api.com/errors')
)
```

### Error Filters

```typescript
import { errorReporter, ErrorFilters } from '@revealui/core/error-handling'

// Ignore browser extension errors
errorReporter.addFilter(ErrorFilters.ignoreExtensions)

// Ignore network errors
errorReporter.addFilter(ErrorFilters.ignoreNetwork)

// Ignore cancelled requests
errorReporter.addFilter(ErrorFilters.ignoreCancelled)

// Custom filter
errorReporter.addFilter((error) => {
  return !error.message.includes('known issue')
})
```

## Error Types

### Built-in Error Types

```typescript
import {
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from '@revealui/core/error-handling'

// Network errors
throw new NetworkError('Connection failed', 503)

// Validation errors
throw new ValidationError('Invalid email', {
  email: 'Invalid format',
})

// Authentication errors
throw new AuthenticationError('Token expired')

// Not found errors
throw new NotFoundError('User not found', 'User')
```

### Error Classification

```typescript
import {
  isNetworkError,
  isValidationError,
  getErrorSeverity,
  shouldRetryError,
} from '@revealui/core/error-handling'

try {
  await fetchData()
} catch (error) {
  if (isNetworkError(error)) {
    // Handle network error
  }

  const severity = getErrorSeverity(error)
  // 'low' | 'medium' | 'high' | 'critical'

  if (shouldRetryError(error)) {
    // Retry the operation
  }
}
```

## Best Practices

### 1. Layer Error Boundaries

Wrap different parts of your app with error boundaries:

```tsx
<ErrorBoundary> {/* App level */}
  <Header />

  <ErrorBoundary isolate> {/* Feature level */}
    <Sidebar />
  </ErrorBoundary>

  <main>
    <ErrorBoundary> {/* Page level */}
      <PageContent />
    </ErrorBoundary>
  </main>
</ErrorBoundary>
```

### 2. Combine Retry with Circuit Breaker

```typescript
import { retry, withCircuitBreaker, RetryPolicies } from '@revealui/core/error-handling'

const fetchData = () => {
  return withCircuitBreaker(
    'api-service',
    async () => {
      return retry(
        async () => {
          const response = await fetch('/api/data')
          return response.json()
        },
        RetryPolicies.aggressive()
      )
    }
  )
}
```

### 3. Monitor Circuit Breaker Health

```typescript
import { circuitBreakerRegistry } from '@revealui/core/error-handling'

// Check breaker health periodically
setInterval(() => {
  const stats = circuitBreakerRegistry.getAllStats()

  Object.entries(stats).forEach(([name, stat]) => {
    if (stat.state === 'open') {
      console.warn(`Circuit breaker ${name} is open!`)
      // Alert operations team
    }
  })
}, 60000)
```

### 4. Track Error Context

Always include relevant context when reporting errors:

```typescript
errorReporter.captureError(error, {
  context: {
    component: 'CheckoutForm',
    action: 'submitPayment',
    route: '/checkout',
  },
  tags: {
    feature: 'payments',
    priority: 'high',
  },
  extra: {
    orderId: '12345',
    amount: 99.99,
    paymentMethod: 'card',
  },
})
```

### 5. Graceful Degradation

Provide fallback functionality when primary systems fail:

```tsx
<ErrorBoundary
  fallback={
    <DegradedServiceFallback serviceName="Recommendations">
      <SimpleProductList />
    </DegradedServiceFallback>
  }
>
  <PersonalizedRecommendations />
</ErrorBoundary>
```

## Performance Impact

| Feature | Overhead | Impact |
|---------|----------|--------|
| Error Boundary | Negligible | <1ms render time |
| Retry Logic | Per retry | Depends on retry delays |
| Circuit Breaker | <1ms | Per execution |
| Error Reporting | 2-5ms | Async, non-blocking |
| Breadcrumbs | <1ms | Per breadcrumb |

## TypeScript Support

All components and utilities are fully typed:

```typescript
import type {
  ErrorBoundaryProps,
  RetryConfig,
  CircuitBreakerConfig,
  ErrorReport,
  ErrorContext,
} from '@revealui/core/error-handling'
```

## Testing

```typescript
import { describe, it, expect } from 'vitest'
import { retry, CircuitBreaker } from '@revealui/core/error-handling'

describe('Error Handling', () => {
  it('should retry on failure', async () => {
    let attempts = 0
    const result = await retry(async () => {
      attempts++
      if (attempts < 3) throw new Error('Fail')
      return 'success'
    })

    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('should open circuit after failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 })

    for (let i = 0; i < 3; i++) {
      await breaker.execute(async () => {
        throw new Error('Fail')
      }).catch(() => {})
    }

    expect(breaker.isOpen()).toBe(true)
  })
})
```

## Migration Guide

### From try/catch to Retry

Before:
```typescript
let attempts = 0
while (attempts < 3) {
  try {
    return await fetchData()
  } catch (error) {
    attempts++
    if (attempts === 3) throw error
    await sleep(1000 * attempts)
  }
}
```

After:
```typescript
import { retry } from '@revealui/core/error-handling'

return await retry(fetchData, { maxRetries: 3, baseDelay: 1000 })
```

### From Manual State to Circuit Breaker

Before:
```typescript
let failures = 0
let lastFailure = 0

async function fetchData() {
  if (failures >= 5 && Date.now() - lastFailure < 30000) {
    throw new Error('Service unavailable')
  }

  try {
    const result = await fetch('/api/data')
    failures = 0
    return result
  } catch (error) {
    failures++
    lastFailure = Date.now()
    throw error
  }
}
```

After:
```typescript
import { withCircuitBreaker } from '@revealui/core/error-handling'

const fetchData = () => withCircuitBreaker(
  'data-service',
  async () => fetch('/api/data'),
  { failureThreshold: 5, resetTimeout: 30000 }
)
```

## License

MIT
