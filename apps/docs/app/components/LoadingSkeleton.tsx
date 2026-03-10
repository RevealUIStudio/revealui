/**
 * Loading skeleton component for better UX during markdown file loading
 */

export function LoadingSkeleton() {
  return (
    <div style={{ padding: '2.5rem 2rem', maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      {/* Title skeleton */}
      <div
        style={{
          height: '2rem',
          width: '55%',
          background: 'var(--color-border)',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />

      {/* Paragraph skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: '1rem' }}>
          <div
            style={{
              height: '0.875rem',
              width: '100%',
              background: 'var(--color-border)',
              borderRadius: '4px',
              marginBottom: '0.5rem',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }}
          />
          <div
            style={{
              height: '0.875rem',
              width: '80%',
              background: 'var(--color-border)',
              borderRadius: '4px',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1 + 0.05}s`,
            }}
          />
        </div>
      ))}

      {/* Code block skeleton */}
      <div
        style={{
          height: '7rem',
          width: '100%',
          background: 'var(--color-code-bg)',
          borderRadius: '8px',
          marginTop: '1.5rem',
          border: '1px solid var(--color-border)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}

/**
 * Compact loading indicator for inline use
 */
export function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-border)',
          borderTop: '3px solid var(--color-accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}
