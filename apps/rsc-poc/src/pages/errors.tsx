import { ErrorsClient } from './errors-client.tsx';

/**
 * Error + observability dogfood (Phase 2.3.2 / 2.3.3).
 * - Client throw: ErrorBoundary + captureException (browser console sink)
 * - Server boom: renderRequest onError → captureException (Node console sink)
 * - notFound: controlled 404 (not an error capture)
 */
export function ErrorsPage(): React.ReactNode {
  return (
    <div>
      <h1>Errors — dogfood (2.3.2 + 2.3.3)</h1>
      <p>
        Client throw is isolated by <code>ErrorBoundary</code> and reported via{' '}
        <code>@revealui/core/observability/capture</code>. Server failures use controlled 404 / 500
        shells from <code>renderRequest</code>; loader throws also hit the Node capture sink (dev
        console).
      </p>
      <p>
        Zero <code>@sentry/nextjs</code>. Init: <code>src/observability/node.ts</code> +{' '}
        <code>browser.ts</code>.
      </p>
      <ul>
        <li>
          <a href="/errors/not-found">Server notFound()</a> (expect 404 shell)
        </li>
        <li>
          <a href="/errors/boom">Server loader throw</a> (expect 500 shell + Node log)
        </li>
      </ul>
      <ErrorsClient />
    </div>
  );
}
