/**
 * Error Boundary component to catch React rendering errors
 * Prevents the entire app from crashing when markdown rendering fails
 */

import { logger } from '@revealui/core/observability/logger';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    logger.error('[ErrorBoundary] Caught error', error, {
      componentStack: errorInfo.componentStack,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="mx-auto max-w-[var(--width-content)] p-8">
          <h1 className="text-2xl font-bold text-red-600">Error Loading Content</h1>
          <p className="mt-2 text-text-secondary">
            An error occurred while rendering this content. This might be due to:
          </p>
          <ul className="mt-2 list-disc pl-6 text-text-secondary">
            <li>Invalid markdown syntax</li>
            <li>Missing or corrupted file</li>
            <li>Rendering issue with content</li>
          </ul>
          {this.state.error && (
            <details className="mt-4 rounded-lg border border-border bg-code-bg p-4">
              <summary className="cursor-pointer font-semibold text-text-primary">
                Technical Details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            type="button"
            className="mt-4 cursor-pointer rounded-lg border-none bg-accent px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
