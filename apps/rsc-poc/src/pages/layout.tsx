/**
 * Shared document + chrome layout for all RSC POC routes.
 * Nav uses plain anchors so the browser entry can intercept and re-fetch RSC
 * flight (D3 full Link→router payload ownership lands in 2.2.3).
 */
export function AppLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>RSC POC — dual-mode router</title>
      </head>
      <body>
        <nav
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            marginBottom: '24px',
            display: 'flex',
            gap: '16px',
          }}
        >
          <a href="/">Home</a>
          <a href="/counter">Counter</a>
          <a href="/actions">Actions</a>
          <a href="/session">Session</a>
          <a href="/errors">Errors</a>
        </nav>
        <main style={{ padding: '0 16px' }}>{children}</main>
      </body>
    </html>
  );
}
