import { logger } from '@revealui/core/observability/logger';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useWildcardPath } from '../hooks/useWildcardPath';
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown';
import { resolveDocPath } from '../utils/paths';

function GuideContent() {
  const path = useWildcardPath();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGuide() {
      try {
        setLoading(true);
        setError(null);

        // Use shared path resolution utility
        const resolved = resolveDocPath({
          section: 'guides',
          routePath: path || null,
        });

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true); // Use cache
          setContent(loaded);
        } catch (loadError) {
          // Log error for debugging
          logger.error(
            `[GuidesPage] Failed to load guide: ${resolved.markdownPath}`,
            loadError instanceof Error ? loadError : new Error(String(loadError)),
          );

          // Fallback to placeholder
          setContent(`# Guide: ${resolved.displayPath || 'Index'}

Guide not found at \`${resolved.markdownPath}\`.

Available guides are loaded from the \`docs/guides/\` directory.
`);
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load guide';
        setError(errorMessage);
        logger.error(
          '[GuidesPage] Error loading guide',
          err instanceof Error ? err : new Error(String(err)),
        );
        setLoading(false);
      }
    }

    void loadGuide();
  }, [path]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <h1>Error Loading Guide</h1>
        <p>{error}</p>
      </div>
    );
  }

  const guideFileName = path || 'index';
  const githubUrl = `https://github.com/RevealUIStudio/revealui/blob/main/docs/guides/${guideFileName}.md`;

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

function GuideIndex() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIndex() {
      try {
        // Use shared path resolution utility for index
        const resolved = resolveDocPath({
          section: 'guides',
          routePath: null,
        });

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true); // Use cache
        setContent(indexContent);
      } catch (error) {
        // Log error for debugging
        logger.error(
          '[GuidesPage] Failed to load guides index',
          error instanceof Error ? error : new Error(String(error)),
        );

        // Fallback
        setContent(`# Guides

Welcome to the RevealUI Framework guides section.

Guides are located in the \`docs/guides/\` directory. Available guides will be listed here once files are copied to the public directory.
`);
      } finally {
        setLoading(false);
      }
    }

    void loadIndex();
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  );
}

export function GuidesPage() {
  const path = useWildcardPath();

  // If no path, show index
  if (!path || path === '') {
    return <GuideIndex />;
  }

  return <GuideContent />;
}
