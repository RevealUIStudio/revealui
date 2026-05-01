import { logger } from '@revealui/core/observability/logger';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useWildcardPath } from '../hooks/useWildcardPath';
import { SLUG_TO_PATH } from '../lib/slug-manifest';
import { loadMarkdownFile, renderMarkdown } from '../utils/markdown';
import type { DocSection } from '../utils/paths';
import { resolveDocPath } from '../utils/paths';

interface SectionPageProps {
  section: DocSection;
  title: string;
  fallbackIndex?: string;
}

function SectionContent({ section, title }: SectionPageProps) {
  const path = useWildcardPath();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoc() {
      try {
        setLoading(true);
        setError(null);

        const resolved = resolveDocPath({
          section,
          routePath: path || null,
        });

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true);
          setContent(loaded);
        } catch (loadError) {
          logger.error(
            `[${title}] Failed to load: ${resolved.markdownPath}`,
            loadError instanceof Error ? loadError : new Error(String(loadError)),
          );

          setContent(`# ${title}: ${resolved.displayPath || 'Index'}

Document not found at \`${resolved.markdownPath}\`.

[Back to ${title}](/${section})
`);
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to load ${title}`;
        setError(errorMessage);
        logger.error(`[${title}] Error`, err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }

    void loadDoc();
  }, [path, section, title]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[var(--width-content)] p-8">
        <h1 className="text-2xl font-bold text-red-600">Error Loading {title}</h1>
        <p className="mt-2 text-text-secondary">{error}</p>
      </div>
    );
  }

  // CHIP-3 D2b: path is a lowercase-kebab slug for the 'docs' section.
  // Resolve it back to the original filename via the manifest so the
  // GitHub edit link points at the real source file (e.g. ADMIN_GUIDE.md).
  const slugKey = (path ?? '').replace(/\.(md|mdx)$/, '');
  const sourceFile = SLUG_TO_PATH[slugKey] ?? (slugKey ? `${slugKey}.md` : 'INDEX.md');
  const githubUrl = `https://github.com/RevealUIStudio/revealui/blob/main/docs/${sourceFile}`;

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

function SectionIndex({ section, title, fallbackIndex }: SectionPageProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIndex() {
      try {
        const resolved = resolveDocPath({
          section,
          routePath: null,
        });

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true);
        setContent(indexContent);
      } catch (error) {
        logger.error(
          `[${title}] Failed to load index`,
          error instanceof Error ? error : new Error(String(error)),
        );

        setContent(
          fallbackIndex ||
            `# ${title}

Content is being organized. Check back soon!
`,
        );
      } finally {
        setLoading(false);
      }
    }

    void loadIndex();
  }, [section, title, fallbackIndex]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <ErrorBoundary>
      <div>{renderMarkdown(content)}</div>
    </ErrorBoundary>
  );
}

export function SectionPage(props: SectionPageProps) {
  const path = useWildcardPath();

  if (!path || path === '') {
    return <SectionIndex {...props} />;
  }

  return <SectionContent {...props} />;
}
