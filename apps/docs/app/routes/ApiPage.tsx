import { logger } from '@revealui/core/observability/logger';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useWildcardPath } from '../hooks/useWildcardPath';
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown';
import { resolveDocPath } from '../utils/paths';

function ApiPackageContent() {
  const path = useWildcardPath();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadApiDoc() {
      try {
        setLoading(true);
        setError(null);

        // Use shared path resolution utility
        const resolved = resolveDocPath({
          section: 'api',
          routePath: path || null,
        });

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true); // Use cache
          setContent(loaded);
        } catch (loadError) {
          // Log error for debugging
          logger.error(
            `[ApiPage] Failed to load API docs: ${resolved.markdownPath}`,
            loadError instanceof Error ? loadError : new Error(String(loadError)),
          );

          // Fallback to helpful message
          setContent(`# API Documentation: ${resolved.displayPath || 'Index'}

API documentation not found at \`${resolved.markdownPath}\`.

To generate API documentation, run:

\`\`\`bash
pnpm docs:generate:api
\`\`\`

This will create markdown files in \`docs/api/\` that are automatically copied to the public directory and loaded here.
`);
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load API docs';
        setError(errorMessage);
        logger.error(
          '[ApiPage] Error loading API docs',
          err instanceof Error ? err : new Error(String(err)),
        );
        setLoading(false);
      }
    }

    void loadApiDoc();
  }, [path]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <h1>Error Loading API Documentation</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  );
}

function ApiIndex() {
  const content = `# API Reference

Complete API documentation for RevealUI.

## REST API

- [REST API Reference](./rest-api) — all endpoints, request/response schemas, authentication

Start the API server (\`pnpm dev:api\`) and open [http://localhost:3004](http://localhost:3004) for the interactive Swagger UI with a request builder.

## Regenerating

The REST API reference is generated from the live OpenAPI spec:

\`\`\`bash
curl http://localhost:3004/openapi.json > examples/api/openapi.json
pnpm docs:generate:api
\`\`\`
`;

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  );
}

export function ApiPage() {
  const path = useWildcardPath();

  if (!path || path === '') {
    return <ApiIndex />;
  }

  return <ApiPackageContent />;
}
