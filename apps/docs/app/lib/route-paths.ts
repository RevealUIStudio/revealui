/**
 * Client-safe docs route path and title helpers.
 * Filesystem discovery lives in route-catalog.server.ts so the browser bundle
 * does not import node:fs.
 */

import { parseFrontmatter } from '../utils/frontmatter';
import { canonicalUrl } from './html-shell';
import { DEFAULT_DESCRIPTION, SITE_TITLE } from './site-copy';
import { pathToSlugLookup } from './slug-manifest';

export const DOCS_ORIGIN = 'https://docs.revealui.com';

export interface DocsRouteShell {
  path: string;
  title: string;
  description: string;
  canonical: string;
}

export function docsDocumentTitle(pageTitle: string): string {
  const trimmed = pageTitle.trim();
  if (trimmed === '' || trimmed === SITE_TITLE) {
    return SITE_TITLE;
  }
  const suffix = ' · RevealUI Docs';
  if (trimmed.endsWith(suffix)) {
    return trimmed;
  }
  return `${trimmed}${suffix}`;
}

export function routePathForDoc(rel: string): string | null {
  const normalized = rel.split('\\').join('/');
  if (normalized === 'api/README.md') {
    return null;
  }
  if (normalized.startsWith('api/') && normalized.endsWith('/README.md')) {
    const rest = normalized.slice('api/'.length, -'/README.md'.length);
    if (rest.length > 0 && !rest.includes('/')) {
      return `/api/${rest}`;
    }
  }
  const slug = pathToSlugLookup(normalized);
  if (!slug || slug === 'index' || slug.endsWith('/readme')) {
    return null;
  }
  return `/${slug}`;
}

function firstHeading(body: string): string {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('# ')) {
      return line.slice(2).trim();
    }
  }
  return '';
}

export function titleFromMarkdown(
  markdown: string,
  fallbackTitle: string,
): { title: string; description: string } {
  const parsed = parseFrontmatter(markdown);
  const fmTitle = typeof parsed.data.title === 'string' ? parsed.data.title.trim() : '';
  const heading = fmTitle === '' ? firstHeading(parsed.body) : fmTitle;
  const fmDescription =
    typeof parsed.data.description === 'string' ? parsed.data.description.trim() : '';
  return {
    title: heading === '' ? fallbackTitle : heading,
    description: fmDescription === '' ? DEFAULT_DESCRIPTION : fmDescription,
  };
}

export function docsShell(routePath: string, title: string, description: string): DocsRouteShell {
  return {
    path: routePath,
    title,
    description,
    canonical: canonicalUrl(DOCS_ORIGIN, routePath),
  };
}
