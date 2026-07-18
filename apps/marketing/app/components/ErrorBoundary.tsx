import { ButtonCVA } from '@revealui/presentation';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureRenderError } from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Forward to Sentry if the SDK was initialised. No-op when VITE_SENTRY_DSN
    // is absent so dev and pre-DSN production builds stay quiet.
    captureRenderError(error, { componentStack: info.componentStack ?? null });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Error</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while rendering this page. Our team has been notified.
      </p>
      <ButtonCVA asChild variant="primary" className="mt-6">
        <a href="/">Return home</a>
      </ButtonCVA>
    </div>
  );
}
