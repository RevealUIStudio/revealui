import { logger } from '@revealui/core/observability/logger';
import { Button } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useWildcardPath } from '../hooks/useWildcardPath';
import { applyDocHead, setRobotsNoindex } from '../lib/head';
import { slugToPath } from '../lib/slug-manifest';
import { loadMarkdownFile, parseFrontmatter, renderMarkdown } from '../utils/markdown';
import type { DocSection } from '../utils/paths';
import { resolveDocPath, stripDocExtension } from '../utils/paths';

/** True when the first non-blank line of `markdown` is an ATX H1 (`# `). */
function startsWithH1(markdown: string): boolean {
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    return line.startsWith('# ');
  }
  return false;
}

/** Format an ISO date for display, or '' when absent / unparseable. */
function formatPostDate(iso: string): string {
  if (iso === '') {
    return '';
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

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
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function loadDoc() {
      try {
        setLoading(true);
        setError(null);

        const resolved = resolveDocPath({
          section,
          routePath: path || null,
        });

        try {
          const loaded = await loadMarkdownFile(resolved.markdownPath, true, ctrl.signal);
          if (!cancelled) {
            setContent(loaded);
            setNotFound(false);
          }
        } catch (loadError) {
          if (!cancelled) {
            logger.error(
              `[${title}] Failed to load: ${resolved.markdownPath}`,
              loadError instanceof Error ? loadError : new Error(String(loadError)),
            );

            setContent(`# ${title}: ${resolved.displayPath || 'Index'}

Document not found at \`${resolved.markdownPath}\`.

[Back to ${title}](/${section})
`);
            setNotFound(true);
          }
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : `Failed to load ${title}`;
          setError(errorMessage);
          logger.error(`[${title}] Error`, err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    void loadDoc();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [path, section, title]);

  // Per-page head: frontmatter title/description when present, else the
  // section title. The crawl-time defaults live in index.html; this keeps
  // SPA navigation in sync. noindex is folded here so the robots tag stays
  // in sync with the head state without a second effect.
  useEffect(() => {
    if (loading || error !== null) {
      return;
    }
    const { data } = parseFrontmatter(content);
    const fmTitle = typeof data.title === 'string' ? data.title.trim() : '';
    const fmDescription = typeof data.description === 'string' ? data.description.trim() : '';
    applyDocHead({
      title: fmTitle === '' ? title : fmTitle,
      description: fmDescription,
    });
    setRobotsNoindex(notFound);
    return () => setRobotsNoindex(false);
  }, [loading, error, content, title, notFound]);

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
  const slugKey = stripDocExtension(path ?? '');
  const sourceFile = slugToPath(slugKey) ?? (slugKey ? `${slugKey}.md` : 'INDEX.md');
  const githubUrl = `https://github.com/RevealUIStudio/revealui/blob/main/docs/${sourceFile}`;

  // Frontmatter-driven page chrome: when a doc carries a frontmatter `title`
  // and its body no longer opens with an H1 (e.g. migrated blog posts), render
  // the title + byline as chrome. Docs that still lead with their own H1 are
  // left untouched, so the title is never rendered twice.
  const { data, body } = parseFrontmatter(content);
  const fmTitle = typeof data.title === 'string' ? data.title.trim() : '';
  const fmAuthor = typeof data.author === 'string' ? data.author.trim() : '';
  const fmDate = typeof data.date === 'string' ? data.date.trim() : '';
  const showHeader = fmTitle !== '' && !startsWithH1(body);
  const byline = [fmAuthor ? `By ${fmAuthor}` : '', formatPostDate(fmDate)]
    .filter((part) => part !== '')
    .join(' · ');

  return (
    <ErrorBoundary>
      {showHeader ? (
        <header className="mx-auto mb-8 max-w-[var(--width-content)] px-8">
          <h1 className="font-bold text-3xl text-text-primary tracking-tight">{fmTitle}</h1>
          {byline !== '' ? <p className="mt-2 text-[0.9375rem] text-text-muted">{byline}</p> : null}
        </header>
      ) : null}
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
        <Button
          type="button"
          appearance="link"
          variant="neutral"
          size="sm"
          className="h-auto p-0 text-text-muted"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          Back to top
        </Button>
      </div>
    </ErrorBoundary>
  );
}

function SectionIndex({ section, title, fallbackIndex }: SectionPageProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function loadIndex() {
      try {
        const resolved = resolveDocPath({
          section,
          routePath: null,
        });

        const indexContent = await loadMarkdownFile(resolved.markdownPath, true, ctrl.signal);
        if (!cancelled) setContent(indexContent);
      } catch (error) {
        if (!cancelled) {
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadIndex();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [section, title, fallbackIndex]);

  // Section landing pages carry the section title in the head.
  useEffect(() => {
    if (!loading) {
      applyDocHead({ title });
    }
  }, [loading, title]);

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
