/**
 * After `vite build`, write one HTML shell per marketing route so crawlers
 * see that route's title, description, canonical, and social tags.
 * Unknown paths are left for `404.html` (noindex, no canonical).
 */

import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyHtmlShell,
  extractLocs,
  type HtmlShellHead,
  readCanonicalHref,
  readRobots,
  shellRelativePath,
} from './html-shell';
import {
  MARKETING_NOT_FOUND_TITLE,
  MARKETING_ORIGIN,
  MARKETING_ROUTE_HEADS,
  MARKETING_UNLISTED_SHELLS,
  type MarketingRouteHead,
  marketingCanonical,
  marketingOgImage,
} from './route-heads';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface VercelRedirect {
  source: string;
  has?: Array<{ type: string }>;
}

function redirectedExactPaths(): Set<string> {
  const config = JSON.parse(readFileSync(path.join(APP_ROOT, 'vercel.json'), 'utf8')) as {
    redirects?: VercelRedirect[];
  };
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

function shellFor(head: MarketingRouteHead): HtmlShellHead {
  const canonical = marketingCanonical(head.path);
  const isHome = head.path === '/';
  return {
    title: head.title,
    description: head.description,
    canonical,
    image: isHome ? undefined : marketingOgImage(head.title, head.description),
    imageAlt: isHome ? undefined : head.title,
    robots: null,
  };
}

export function marketingShellPlan(): Array<{ path: string; head: HtmlShellHead }> {
  return [...MARKETING_ROUTE_HEADS, ...MARKETING_UNLISTED_SHELLS].map((head) => ({
    path: head.path,
    head: shellFor(head),
  }));
}

export function assertMarketingSitemapShells(
  locs: string[],
  shells: Array<{ path: string; head: HtmlShellHead }>,
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
    if (shell.head.canonical !== loc) {
      throw new Error(`canonical ${shell.head.canonical ?? 'none'} does not equal sitemap ${loc}`);
    }
  }
}

export async function writeMarketingShells(outDir: string): Promise<void> {
  const indexPath = path.join(outDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  const shells = marketingShellPlan();
  const sitemap = await readFile(path.join(APP_ROOT, 'public/sitemap.xml'), 'utf8');
  assertMarketingSitemapShells(extractLocs(sitemap), shells, redirectedExactPaths());

  for (const shell of shells) {
    const html = applyHtmlShell(indexHtml, shell.head);
    const canonical = readCanonicalHref(html);
    if (canonical !== shell.head.canonical) {
      throw new Error(
        `wrote ${shell.path} with canonical ${canonical ?? 'none'}, expected ${shell.head.canonical}`,
      );
    }
    const rel = shellRelativePath(shell.path);
    const dest = path.join(outDir, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }

  const notFound = applyHtmlShell(indexHtml, {
    title: MARKETING_NOT_FOUND_TITLE,
    description: "The page you're looking for doesn't exist or has moved.",
    canonical: null,
    robots: 'noindex',
  });
  if (readCanonicalHref(notFound) !== null) {
    throw new Error('marketing 404 shell must not include a canonical');
  }
  if (readRobots(notFound) !== 'noindex') {
    throw new Error('marketing 404 shell must be noindex');
  }
  await writeFile(path.join(outDir, '404.html'), notFound);
}

export function marketingOrigin(): string {
  return MARKETING_ORIGIN;
}
