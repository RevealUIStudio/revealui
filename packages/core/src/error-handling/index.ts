/**
 * Error Handling & Recovery
 *
 * Comprehensive error handling infrastructure for production applications
 */

// Error boundaries
export {
  ErrorBoundary,
  ErrorBoundaryWithRetry,
  withErrorBoundary,
  useErrorHandler,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  isNetworkError,
  isValidationError,
  isAuthenticationError,
  isNotFoundError,
  getErrorSeverity,
  shouldRetryError,
} from './error-boundary'

export type {
  ErrorInfo,
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorBoundaryWithRetryProps,
  ErrorSeverity,
} from './error-boundary'

// Retry logic
export {
  retry,
  calculateDelay,
  sleep,
  fetchWithRetry,
  RetryableOperation,
  Retryable,
  createRetryMiddleware,
  retryBatch,
  retryWithFallback,
  retryIf,
  retryUntil,
  ExponentialBackoff,
  RetryPolicyBuilder,
  RetryPolicies,
  globalRetryConfig,
} from './retry'

export type { RetryConfig, RetryOptions } from './retry'

// Circuit breakers
export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  CircuitBreak,
  withCircuitBreaker,
  createCircuitBreakerMiddleware,
  fetchWithCircuitBreaker,
  AdaptiveCircuitBreaker,
  Bulkhead,
  ResilientOperation,
  createResilientFunction,
} from './circuit-breaker'

export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from './circuit-breaker'

// Fallback components
export {
  ErrorFallback,
  NetworkErrorFallback,
  NotFoundFallback,
  LoadingFallback,
  OfflineFallback,
  DegradedServiceFallback,
  MaintenanceFallback,
  PermissionDeniedFallback,
  RetryBoundary,
  SuspenseFallback,
  FeatureUnavailableFallback,
  InlineError,
  SuccessMessage,
  Toast,
  Skeleton,
} from './fallback-components'

export type { ErrorFallbackProps } from './fallback-components'

// Error reporting
export {
  ErrorReportingSystem,
  errorReporter,
  ConsoleErrorReporter,
  SentryErrorReporter,
  HTTPErrorReporter,
  initializeErrorReporting,
  trackAction,
  trackNavigation,
  trackAPICall,
  ErrorFilters,
} from './error-reporter'

export type {
  ErrorReport,
  ErrorContext,
  UserContext,
  ErrorLevel,
  ErrorReporter,
  Breadcrumb,
} from './error-reporter'
