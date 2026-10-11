/**
 * After `vite build`, write one HTML shell per docs route so crawlers see
 * that route's title, description, canonical, and social tags.
 */

import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyHtmlShell,
  extractLocs,
  readCanonicalHref,
  readRobots,
  shellRelativePath,
} from './html-shell';
import { collectDocsRouteShells, type DocsRouteShell } from './route-catalog.server';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OG_BASE = 'https://api.revealui.com/api/og';

interface VercelRedirect {
  source: string;
  has?: Array<{ type: string }>;
}

export function redirectedExactPaths(vercelJson: string): Set<string> {
  const config = JSON.parse(vercelJson) as { redirects?: VercelRedirect[] };
  const paths = new Set<string>();
  for (const redirect of config.redirects ?? []) {
    if ((redirect.has ?? []).some((condition) => condition.type === 'host')) {
      continue;
    }
    if (
      redirect.source.includes(':') ||
      redirect.source.includes('*') ||
      redirect.source.includes('(')
    ) {
      continue;
    }
    paths.add(redirect.source);
  }
  return paths;
}

function ogImage(title: string, description: string): string {
  const params = new URLSearchParams({ title, description });
  return `${OG_BASE}?${params.toString()}`;
}

export function assertDocsSitemapShells(
  locs: string[],
  shells: DocsRouteShell[],
  redirected: Set<string>,
): void {
  for (const loc of locs) {
    const pathname = new URL(loc).pathname;
    if (redirected.has(pathname)) {
      continue;
    }
    const shell = shells.find((entry) => entry.path === pathname);
    if (!shell) {
      throw new Error(`sitemap route ${loc} has no HTML shell`);
    }
    if (shell.canonical !== loc) {
      throw new Error(`canonical ${shell.canonical} does not equal sitemap ${loc}`);
    }
  }
}

export async function writeDocsShells(outDir: string): Promise<DocsRouteShell[]> {
  const indexHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const shells = await collectDocsRouteShells();
  const sitemap = await readFile(path.join(APP_ROOT, 'public/sitemap.xml'), 'utf8');
  const vercel = readFileSync(path.join(APP_ROOT, 'vercel.json'), 'utf8');
  assertDocsSitemapShells(extractLocs(sitemap), shells, redirectedExactPaths(vercel));

  for (const shell of shells) {
    const html = applyHtmlShell(indexHtml, {
      title: shell.title,
      description: shell.description,
      canonical: shell.canonical,
      image: ogImage(shell.title, shell.description),
      imageAlt: shell.title,
      robots: null,
    });
    const canonical = readCanonicalHref(html);
    if (canonical !== shell.canonical) {
      throw new Error(
        `wrote ${shell.path} with canonical ${canonical ?? 'none'}, expected ${shell.canonical}`,
      );
    }
    const dest = path.join(outDir, shellRelativePath(shell.path));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }

  const notFound = applyHtmlShell(indexHtml, {
    title: 'Not Found · RevealUI Docs',
    description: 'This documentation page does not exist.',
    canonical: null,
    robots: 'noindex',
  });
  if (readCanonicalHref(notFound) !== null) {
    throw new Error('docs 404 shell must not include a canonical');
  }
  if (readRobots(notFound) !== 'noindex') {
    throw new Error('docs 404 shell must be noindex');
  }
  await writeFile(path.join(outDir, '404.html'), notFound);
  return shells;
}
