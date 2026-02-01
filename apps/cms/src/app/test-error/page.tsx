'use client'

/**
 * Test page for verifying ErrorBoundary and Sentry integration
 *
 * Visit this page to trigger a React error and verify:
 * 1. ErrorBoundary catches the error and displays fallback UI
 * 2. Sentry captures the error (if NEXT_PUBLIC_SENTRY_DSN is configured)
 *
 * DELETE THIS FILE after testing is complete.
 */

import { useState } from 'react'

export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false)

  if (shouldThrow) {
    throw new Error('Test Error: ErrorBoundary and Sentry Integration Check')
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Error Boundary Test Page</h1>

      <p style={{ marginBottom: '1rem' }}>
        This page is used to test the ErrorBoundary and Sentry integration.
      </p>

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
        <strong>⚠️ Warning:</strong> Clicking the button below will trigger a React error.
      </div>

      <button
        onClick={() => setShouldThrow(true)}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 'bold',
        }}
      >
        Trigger React Error
      </button>

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <h2>Expected Behavior:</h2>
        <ol>
          <li>Click the button above</li>
          <li>ErrorBoundary should catch the error</li>
          <li>Fallback UI should display with "Try Again" and "Reload Page" buttons</li>
          <li>Error should be sent to Sentry (check your Sentry dashboard)</li>
        </ol>

        <p style={{ marginTop: '1rem' }}>
          <strong>Note:</strong> Delete this file (<code>apps/cms/src/app/test-error/page.tsx</code>)
          after verifying the error handling works correctly.
        </p>
      </div>
    </div>
  )
}
