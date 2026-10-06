import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyHtmlShell,
  extractLocs,
  readCanonicalHref,
  readMetaContent,
  readRobots,
  readTitle,
  withoutTrailingSlash,
} from '../html-shell';
import { collectDocsRouteShells, routePathForDoc } from '../route-catalog.server';
import { assertDocsSitemapShells, redirectedExactPaths } from '../write-docs-shells.server';

const indexHtml = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const vercelJson = readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8');

describe('docs route paths', () => {
  it('maps the REST reference to /api/rest-api and skips the redirected /api index', () => {
    expect(routePathForDoc('api/rest-api/README.md')).toBe('/api/rest-api');
    expect(routePathForDoc('api/README.md')).toBeNull();
    expect(routePathForDoc('ADMIN_GUIDE.md')).toBe('/admin-guide');
    expect(routePathForDoc('guides/quick-start.md')).toBe('/guides/quick-start');
  });
});

describe('docs route shells', () => {
  it('sets each sitemap canonical equal to that route URL', async () => {
    const shells = await collectDocsRouteShells();
    const sitemap = extractLocs(
      readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf8'),
    );
    const redirected = redirectedExactPaths(vercelJson);
    expect(redirected.has('/api')).toBe(true);
    expect(redirected.has('/mcp')).toBe(true);
    assertDocsSitemapShells(sitemap, shells, redirected);

    for (const loc of sitemap) {
      const pathname = new URL(loc).pathname;
      if (pathname === '/' || redirected.has(pathname)) {
        continue;
      }
      expect(withoutTrailingSlash(`${pathname}/`)).toBe(pathname);
      const shell = shells.find((entry) => entry.path === pathname);
      expect(shell?.canonical).toBe(loc);
    }

    const rest = shells.find((entry) => entry.path === '/api/rest-api');
    expect(rest?.canonical).toBe('https://docs.revealui.com/api/rest-api');
    expect(rest?.title).toContain('REST API');
    const mcp = shells.find((entry) => entry.path === '/pro/mcp');
    expect(mcp?.canonical).toBe('https://docs.revealui.com/pro/mcp');
  });

  it('writes self-referencing social tags and a noindex 404 shell', () => {
    const html = applyHtmlShell(indexHtml, {
      title: 'Admin Guide · RevealUI Docs',
      description: 'How to operate the admin.',
      canonical: 'https://docs.revealui.com/admin-guide',
      image: 'https://api.revealui.com/api/og?title=Admin+Guide',
      imageAlt: 'Admin Guide · RevealUI Docs',
      robots: null,
    });
    expect(readTitle(html)).toBe('Admin Guide · RevealUI Docs');
    expect(readCanonicalHref(html)).toBe('https://docs.revealui.com/admin-guide');
    expect(readMetaContent(html, 'property', 'og:url')).toBe(
      'https://docs.revealui.com/admin-guide',
    );
    expect(readMetaContent(html, 'property', 'og:title')).toBe('Admin Guide · RevealUI Docs');
    expect(readMetaContent(html, 'name', 'twitter:description')).toBe('How to operate the admin.');

    const notFound = applyHtmlShell(indexHtml, {
      title: 'Not Found · RevealUI Docs',
      description: 'This documentation page does not exist.',
      canonical: null,
      robots: 'noindex',
    });
    expect(readCanonicalHref(notFound)).toBeNull();
    expect(readRobots(notFound)).toBe('noindex');
  });
});
