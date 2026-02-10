/**
 * Fallback UI Components
 *
 * Reusable fallback components for error states, loading states, and degraded functionality
 */

/// <reference types="react" />
import React, { type ReactNode } from 'react'

/**
 * Generic error fallback props
 */
export interface ErrorFallbackProps {
  error?: Error
  onRetry?: () => void
  onDismiss?: () => void
  title?: string
  message?: string
  showDetails?: boolean
  compact?: boolean
}

/**
 * Generic error fallback component
 */
export function ErrorFallback({
  error,
  onRetry,
  onDismiss,
  title = 'Something went wrong',
  message,
  showDetails = process.env.NODE_ENV === 'development',
  compact = false,
}: ErrorFallbackProps): React.ReactElement {
  if (compact) {
    return (
      <div
        style={{
          padding: '12px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
        }}
      >
        <strong>{title}</strong>
        {message && <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{message}</p>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: '8px',
              padding: '4px 12px',
              fontSize: '12px',
              backgroundColor: '#c00',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      role="alert"
      style={{
        padding: '24px',
        maxWidth: '600px',
        margin: '40px auto',
        backgroundColor: '#fff',
        border: '2px solid #f44336',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <h2 style={{ color: '#f44336', marginTop: 0 }}>{title}</h2>

      <p style={{ color: '#666', lineHeight: 1.6 }}>
        {message || 'An unexpected error occurred. Please try again.'}
      </p>

      {showDetails && error && (
        <details style={{ marginTop: '16px' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 'bold',
              color: '#333',
              padding: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
            }}
          >
            Error details
          </summary>

          <pre
            style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
              color: '#c00',
            }}
          >
            {error.name}: {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Try Again
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: '10px 20px',
              backgroundColor: '#fff',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Network error fallback
 */
export function NetworkErrorFallback({
  onRetry,
  message = 'Unable to connect to the server. Please check your internet connection.',
}: {
  onRetry?: () => void
  message?: string
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '40px auto',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
      <h3 style={{ color: '#333', marginTop: 0 }}>Connection Error</h3>
      <p style={{ color: '#666', lineHeight: 1.6 }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            backgroundColor: '#2196f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Retry Connection
        </button>
      )}
    </div>
  )
}

/**
 * Not found fallback
 */
export function NotFoundFallback({
  title = 'Page Not Found',
  message = 'The page you are looking for does not exist.',
  onGoHome,
}: {
  title?: string
  message?: string
  onGoHome?: () => void
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '40px auto',
      }}
    >
      <div style={{ fontSize: '72px', marginBottom: '16px' }}>404</div>
      <h2 style={{ color: '#333', marginTop: 0 }}>{title}</h2>
      <p style={{ color: '#666', lineHeight: 1.6 }}>{message}</p>
      {onGoHome && (
        <button
          type="button"
          onClick={onGoHome}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            backgroundColor: '#2196f3',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Go Home
        </button>
      )}
    </div>
  )
}

/**
 * Loading fallback with retry
 */
export function LoadingFallback({
  message = 'Loading...',
  timeout,
  onTimeout,
}: {
  message?: string
  timeout?: number
  onTimeout?: () => void
}): React.ReactElement {
  const [timedOut, setTimedOut] = React.useState(false)

  React.useEffect(() => {
    if (timeout && onTimeout) {
      const timer = setTimeout(() => {
        setTimedOut(true)
        onTimeout()
      }, timeout)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [timeout, onTimeout])

  if (timedOut) {
    return (
      <ErrorFallback
        title="Loading Timeout"
        message="This is taking longer than expected."
        onRetry={onTimeout}
      />
    )
  }

  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '40px auto',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          margin: '0 auto 16px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #2196f3',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ color: '#666' }}>{message}</p>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

/**
 * Offline fallback
 */
export function OfflineFallback({
  message = 'You are currently offline. Some features may be unavailable.',
  children,
}: {
  message?: string
  children?: ReactNode
}): React.ReactElement {
  return (
    <div>
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#fff3cd',
          borderBottom: '1px solid #ffc107',
          textAlign: 'center',
          color: '#856404',
        }}
      >
        <strong>⚠️ Offline Mode</strong>
        <span style={{ marginLeft: '8px', fontSize: '14px' }}>{message}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * Degraded service fallback
 */
export function DegradedServiceFallback({
  serviceName,
  message,
  children,
}: {
  serviceName?: string
  message?: string
  children?: ReactNode
}): React.ReactElement {
  const displayMessage =
    message ||
    (serviceName
      ? `${serviceName} is currently experiencing issues. Some features may be limited.`
      : 'Some services are experiencing issues. Functionality may be limited.')

  return (
    <div>
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#fff3cd',
          borderBottom: '1px solid #ffc107',
          textAlign: 'center',
          color: '#856404',
        }}
      >
        <strong>⚠️ Service Degraded</strong>
        <span style={{ marginLeft: '8px', fontSize: '14px' }}>{displayMessage}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * Maintenance fallback
 */
export function MaintenanceFallback({
  title = 'Under Maintenance',
  message = 'We are currently performing maintenance. Please check back soon.',
  estimatedTime,
}: {
  title?: string
  message?: string
  estimatedTime?: string
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        maxWidth: '500px',
        margin: '40px auto',
      }}
    >
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔧</div>
      <h1 style={{ color: '#333', marginTop: 0 }}>{title}</h1>
      <p style={{ color: '#666', lineHeight: 1.6, fontSize: '16px' }}>{message}</p>
      {estimatedTime && (
        <p style={{ color: '#999', marginTop: '16px' }}>Estimated completion: {estimatedTime}</p>
      )}
    </div>
  )
}

/**
 * Permission denied fallback
 */
export function PermissionDeniedFallback({
  message = 'You do not have permission to access this resource.',
  onRequestAccess,
  onGoBack,
}: {
  message?: string
  onRequestAccess?: () => void
  onGoBack?: () => void
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '40px auto',
      }}
    >
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#333', marginTop: 0 }}>Access Denied</h2>
      <p style={{ color: '#666', lineHeight: 1.6 }}>{message}</p>
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {onRequestAccess && (
          <button
            type="button"
            onClick={onRequestAccess}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Request Access
          </button>
        )}
        {onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            style={{
              padding: '10px 20px',
              backgroundColor: '#fff',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Retry boundary - wrapper that provides retry functionality
 */
export function RetryBoundary({
  children,
  fallback,
  maxRetries = 3,
  retryDelay = 1000,
}: {
  children: ReactNode
  fallback?: (error: Error, retry: () => void, attempt: number) => ReactNode
  maxRetries?: number
  retryDelay?: number
}): React.ReactElement {
  const [error, setError] = React.useState<Error | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)
  const [isRetrying, setIsRetrying] = React.useState(false)

  const retry = React.useCallback(() => {
    if (retryCount < maxRetries) {
      setIsRetrying(true)
      setTimeout(() => {
        setError(null)
        setRetryCount((c) => c + 1)
        setIsRetrying(false)
      }, retryDelay)
    }
  }, [retryCount, maxRetries, retryDelay])

  if (error && !isRetrying) {
    if (fallback) {
      return <>{fallback(error, retry, retryCount)}</>
    }

    return (
      <ErrorFallback
        error={error}
        onRetry={retryCount < maxRetries ? retry : undefined}
        title={retryCount >= maxRetries ? 'Maximum Retries Exceeded' : 'Error'}
        message={
          retryCount >= maxRetries ? 'Unable to recover after multiple attempts.' : undefined
        }
      />
    )
  }

  if (isRetrying) {
    return <LoadingFallback message={`Retrying... (Attempt ${retryCount + 1}/${maxRetries})`} />
  }

  return <>{children}</>
}

/**
 * Suspense fallback with timeout
 */
export function SuspenseFallback({
  message = 'Loading...',
  timeout = 10000,
}: {
  message?: string
  timeout?: number
}): React.ReactElement {
  const [timedOut, setTimedOut] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true)
    }, timeout)

    return () => clearTimeout(timer)
  }, [timeout])

  if (timedOut) {
    return (
      <ErrorFallback
        title="Loading Timeout"
        message="This is taking longer than expected. Please refresh the page."
      />
    )
  }

  return <LoadingFallback message={message} />
}

/**
 * Feature flag fallback
 */
export function FeatureUnavailableFallback({
  featureName,
  message,
}: {
  featureName: string
  message?: string
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '24px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '40px auto',
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
      <h3 style={{ color: '#333', marginTop: 0 }}>Feature Unavailable</h3>
      <p style={{ color: '#666', lineHeight: 1.6 }}>
        {message || `The "${featureName}" feature is currently unavailable.`}
      </p>
    </div>
  )
}

/**
 * Inline error message
 */
export function InlineError({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}): React.ReactElement {
  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        backgroundColor: '#fee',
        border: '1px solid #fcc',
        borderRadius: '4px',
        color: '#c00',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '8px' }}>⚠️</span>
        {message}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#c00',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}

/**
 * Success message
 */
export function SuccessMessage({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}): React.ReactElement {
  return (
    <output
      style={{
        padding: '12px 16px',
        backgroundColor: '#efe',
        border: '1px solid #cec',
        borderRadius: '4px',
        color: '#060',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '8px' }}>✓</span>
        {message}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#060',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </output>
  )
}

/**
 * Toast notification
 */
export function Toast({
  type = 'info',
  message,
  duration = 5000,
  onDismiss,
}: {
  type?: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
  onDismiss?: () => void
}): React.ReactElement {
  React.useEffect(() => {
    if (duration > 0 && onDismiss) {
      const timer = setTimeout(onDismiss, duration)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [duration, onDismiss])

  const colors = {
    success: { bg: '#efe', border: '#cec', text: '#060', icon: '✓' },
    error: { bg: '#fee', border: '#fcc', text: '#c00', icon: '✗' },
    warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404', icon: '!' },
    info: { bg: '#e7f3ff', border: '#2196f3', text: '#0c5393', icon: 'i' },
  }

  const color = colors[type]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '16px 20px',
        backgroundColor: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: '4px',
        color: color.text,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '400px',
        zIndex: 9999,
      }}
    >
      <span style={{ fontSize: '20px' }}>{color.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: color.text,
            cursor: 'pointer',
            fontSize: '20px',
            padding: '0 4px',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}

/**
 * Skeleton loader
 */
export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
}: {
  width?: string | number
  height?: string | number
  borderRadius?: string
}): React.ReactElement {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#e0e0e0',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  )
}
