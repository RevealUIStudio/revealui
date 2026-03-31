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

  const apiFileName = path || 'index';
  const githubUrl = `https://github.com/RevealUIStudio/revealui/blob/main/docs/api/${apiFileName}.md`;

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
      <div className="mx-auto mt-12 flex max-w-[var(--width-content)] items-center justify-between border-t border-border px-8 pt-6 text-[0.8125rem] text-text-muted">
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent no-underline transition-colors hover:text-accent-hover"
        >
          Edit this page on GitHub
        </a>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="cursor-pointer border-none bg-transparent p-0 font-sans text-[inherit] text-text-muted transition-colors hover:text-text-secondary"
        >
          Back to top
        </button>
      </div>
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
