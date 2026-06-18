import { logger } from '@revealui/core/observability/logger';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useNoindex } from '../hooks/useNoindex';
import { useWildcardPath } from '../hooks/useWildcardPath';
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown';
import { sanitizePath } from '../utils/paths';

function ProContent() {
  const routePath = useWildcardPath();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useNoindex(notFound);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function loadDoc() {
      setLoading(true);

      let filePath: string;
      if (!routePath || routePath === '') {
        filePath = '/docs-pro/index.md';
      } else {
        const sanitized = sanitizePath(routePath);
        if (!sanitized) {
          filePath = '/docs-pro/index.md';
        } else if (sanitized.endsWith('.md')) {
          filePath = `/docs-pro/${sanitized}`;
        } else {
          // Try as directory index first, then as direct file
          filePath = `/docs-pro/${sanitized}/index.md`;
        }
      }

      try {
        const loaded = await loadMarkdownFile(filePath, true, ctrl.signal);
        if (!cancelled) {
          setContent(loaded);
          setNotFound(false);
        }
      } catch {
        // Abort means the component unmounted or path changed — do not retry.
        if (ctrl.signal.aborted) return;

        // Fallback: try as .md if index.md failed
        const directPath = filePath.endsWith('/index.md')
          ? filePath.replace('/index.md', '.md')
          : filePath;

        try {
          const loaded = await loadMarkdownFile(directPath, true, ctrl.signal);
          if (!cancelled) {
            setContent(loaded);
            setNotFound(false);
          }
        } catch (err) {
          if (!cancelled) {
            logger.error(
              `[ProPage] Failed to load: ${filePath}`,
              err instanceof Error ? err : new Error(String(err)),
            );
            setContent(`# Not found

Document not found at \`${filePath}\`.

[Back to Pro docs](/pro)
`);
            setNotFound(true);
          }
        }
      }

      if (!cancelled) setLoading(false);
    }

    void loadDoc();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [routePath]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  );
}

export function ProPage() {
  return <ProContent />;
}
