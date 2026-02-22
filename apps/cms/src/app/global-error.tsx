'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <h2>Something went wrong!</h2>
          <p>We apologize for the inconvenience. Please try again.</p>
          {error?.digest && (
            <p style={{ fontSize: '12px', color: '#666' }}>Error ID: {error.digest}</p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: '10px',
              padding: '10px 20px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
