export function NotFoundPage(): React.ReactNode {
  return (
    <div data-router-not-found="" style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404 — Not Found</h1>
      <p>No route matched this path (or a loader called notFound()).</p>
      <p>
        <a href="/">Go Home</a>
        {' · '}
        <a href="/errors">Error dogfood</a>
      </p>
    </div>
  );
}
