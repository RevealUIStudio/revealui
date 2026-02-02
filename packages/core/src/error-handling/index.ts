/**
 * Error Handling & Recovery
 *
 * Comprehensive error handling infrastructure for production applications
 */

export type {
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitState,
} from './circuit-breaker'
// Circuit breakers
export {
  AdaptiveCircuitBreaker,
  Bulkhead,
  CircuitBreak,
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  createCircuitBreakerMiddleware,
  createResilientFunction,
  fetchWithCircuitBreaker,
  ResilientOperation,
  withCircuitBreaker,
} from './circuit-breaker'
export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorBoundaryWithRetryProps,
  ErrorInfo,
  ErrorSeverity,
} from './error-boundary'
// Error boundaries
export {
  AuthenticationError,
  ErrorBoundary,
  ErrorBoundaryWithRetry,
  getErrorSeverity,
  isAuthenticationError,
  isNetworkError,
  isNotFoundError,
  isValidationError,
  NetworkError,
  NotFoundError,
  shouldRetryError,
  useErrorHandler,
  ValidationError,
  withErrorBoundary,
} from './error-boundary'
export type {
  Breadcrumb,
  ErrorContext,
  ErrorLevel,
  ErrorReport,
  ErrorReporter,
  UserContext,
} from './error-reporter'
// Error reporting
export {
  ConsoleErrorReporter,
  ErrorFilters,
  ErrorReportingSystem,
  errorReporter,
  HTTPErrorReporter,
  initializeErrorReporting,
  SentryErrorReporter,
  trackAction,
  trackAPICall,
  trackNavigation,
} from './error-reporter'
export type { ErrorFallbackProps } from './fallback-components'
// Fallback components
export {
  DegradedServiceFallback,
  ErrorFallback,
  FeatureUnavailableFallback,
  InlineError,
  LoadingFallback,
  MaintenanceFallback,
  NetworkErrorFallback,
  NotFoundFallback,
  OfflineFallback,
  PermissionDeniedFallback,
  RetryBoundary,
  Skeleton,
  SuccessMessage,
  SuspenseFallback,
  Toast,
} from './fallback-components'
export type { RetryConfig, RetryOptions } from './retry'
// Retry logic
export {
  calculateDelay,
  createRetryMiddleware,
  ExponentialBackoff,
  fetchWithRetry,
  globalRetryConfig,
  Retryable,
  RetryableOperation,
  RetryPolicies,
  RetryPolicyBuilder,
  retry,
  retryBatch,
  retryIf,
  retryUntil,
  retryWithFallback,
  sleep,
} from './retry'
