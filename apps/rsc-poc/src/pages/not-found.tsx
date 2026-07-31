export function NotFoundPage(): React.ReactNode {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404 — Not Found</h1>
      <p>No route matched this path.</p>
      <p>
        <a href="/">Go Home</a>
      </p>
    </div>
  );
}
