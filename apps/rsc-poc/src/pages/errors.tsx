import { ErrorsClient } from './errors-client.tsx';

/**
 * Error dogfood (Phase 2.3.2).
 * - Client throw: caught by ErrorBoundary in entry.browser
 * - Server paths: /errors/not-found (notFound sentinel), /errors/boom (loader 500)
 */
export function ErrorsPage(): React.ReactNode {
  return (
    <div>
      <h1>Errors — dogfood (2.3.2)</h1>
      <p>
        Client throw is isolated by <code>ErrorBoundary</code>. Server failures use controlled 404 /
        500 shells from <code>renderRequest</code>.
      </p>
      <ul>
        <li>
          <a href="/errors/not-found">Server notFound()</a> (expect 404 shell)
        </li>
        <li>
          <a href="/errors/boom">Server loader throw</a> (expect 500 shell)
        </li>
      </ul>
      <ErrorsClient />
    </div>
  );
}
