/**
 * Error Handling & Recovery
 *
 * Comprehensive error handling infrastructure for production applications
 */

// Circuit breakers  -  re-exported from @revealui/resilience
// Retry logic  -  re-exported from @revealui/resilience
export type {
  CircuitBreakerConfig,
  CircuitBreakerStats,
  CircuitState,
  RetryConfig,
  RetryOptions,
} from '@revealui/resilience';
export {
  AdaptiveCircuitBreaker,
  Bulkhead,
  CircuitBreak,
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  calculateDelay,
  circuitBreakerRegistry,
  createCircuitBreakerMiddleware,
  createResilientFunction,
  createRetryMiddleware,
  ExponentialBackoff,
  fetchWithCircuitBreaker,
  fetchWithRetry,
  globalRetryConfig,
  ResilientOperation,
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
  withCircuitBreaker,
} from '@revealui/resilience';
export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorBoundaryWithRetryProps,
  ErrorInfo,
  ErrorSeverity,
} from './error-boundary';
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
} from './error-boundary';
export type {
  Breadcrumb,
  ErrorContext,
  ErrorLevel,
  ErrorReport,
  ErrorReporter,
  UserContext,
} from './error-reporter';
// Error reporting
export {
  ConsoleErrorReporter,
  ErrorFilters,
  ErrorReportingSystem,
  errorReporter,
  HTTPErrorReporter,
  initializeErrorReporting,
  LoggingErrorReporter,
  trackAction,
  trackAPICall,
  trackNavigation,
} from './error-reporter';
export type { ErrorFallbackProps } from './fallback-components';
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
} from './fallback-components';
