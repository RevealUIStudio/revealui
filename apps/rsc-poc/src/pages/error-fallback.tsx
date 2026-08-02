'use client';

/**
 * Client fallback for ErrorBoundary (2.3.2). No stack dump in UI.
 */
export function ErrorFallback({ error }: { error: Error }): React.ReactNode {
  const isProd = process.env.NODE_ENV === 'production';
  return (
    <div
      data-router-error-boundary=""
      style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #fecaca',
        background: '#fef2f2',
        borderRadius: 8,
        margin: '16px 0',
      }}
    >
      <h2>Something went wrong</h2>
      <p>{isProd ? 'Please try again or go home.' : error.message}</p>
      <p>
        <a href="/">Go Home</a>
        {' · '}
        <a href="/errors">Back to Errors</a>
      </p>
    </div>
  );
}
