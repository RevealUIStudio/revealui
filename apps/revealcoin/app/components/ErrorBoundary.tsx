import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // React surfaces uncaught render errors via the global error handler in dev,
  // so we don't need a componentDidCatch here. Production observability hooks
  // (Sentry/logger) can be added once that integration ships for revealcoin.

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error | null }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">Error</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-md text-sm text-gray-600">
        {error?.message ?? 'An unexpected error occurred while rendering this page.'}
      </p>
      <a
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
      >
        Return home
      </a>
    </div>
  );
}
