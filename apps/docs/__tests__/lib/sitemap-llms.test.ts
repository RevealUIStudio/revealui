/**
 * Discovery-file hygiene: sitemap.xml and llms.txt must not advertise
 * routes that 200-but-render the SPA index.html source as the article.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLUG_TO_PATH } from '../../app/lib/slug-manifest';
import { type DocSection, resolveDocPath } from '../../app/utils/paths';
import { docsPathnameFromUrl } from '../../scripts/docs-url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '../../public');

const CONFIRMED_DEAD = [
  '/ci-cd-guide',
  '/performance',
  '/architecture/adr-002-dual-database',
  '/architecture/adr-005-two-repo-model',
  '/contact',
  '/reference/ai',
  '/reference/auth',
  '/DEPLOYMENT-RUNBOOK',
  '/CREDENTIAL-ROTATION-RUNBOOK',
  '/AUDIT_STATUS',
  '/agent-rules',
  '/agent-rules/',
] as const;

const SPA_PREFIXES = ['/showcase', '/pro'] as const;

function extractBetween(source: string, open: string, close: string): string[] {
  const found: string[] = [];
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf(open, from);
    if (start === -1) {
      break;
    }
    const valueStart = start + open.length;
    const end = source.indexOf(close, valueStart);
    if (end === -1) {
      break;
    }
    found.push(source.slice(valueStart, end).trim());
    from = end + close.length;
  }
  return found;
}

function stripOrigin(url: string): string {
  return docsPathnameFromUrl(url) ?? url;
}

function isSpaPath(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }
  return SPA_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function discoveryPathResolves(pathname: string): boolean {
  if (isSpaPath(pathname)) {
    return true;
  }
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0] ?? '';
  let section: DocSection = 'docs';
  let routePath = segments.join('/');
  if (first === 'guides' || first === 'api') {
    section = first;
    routePath = segments.slice(1).join('/');
  }
  const { markdownPath } = resolveDocPath({
    section,
    routePath: routePath === '' ? null : routePath,
  });
  const rel = markdownPath.startsWith('/') ? markdownPath.slice(1) : markdownPath;
  return Object.values(SLUG_TO_PATH).includes(rel);
}

describe('docs discovery files', () => {
  const sitemap = readFileSync(join(publicDir, 'sitemap.xml'), 'utf8');
  const llms = readFileSync(join(publicDir, 'llms.txt'), 'utf8');
  const sitemapPaths = extractBetween(sitemap, '<loc>', '</loc>').map(stripOrigin);
  const llmsPaths = extractBetween(llms, '](https://docs.revealui.com', ')').map((raw) => {
    let target = raw;
    const space = target.indexOf(' ');
    if (space !== -1) {
      target = target.slice(0, space);
    }
    return stripOrigin(`https://docs.revealui.com${target}`);
  });

  it('sitemap does not list confirmed-dead routes', () => {
    for (const dead of CONFIRMED_DEAD) {
      expect(sitemapPaths).not.toContain(dead);
    }
  });

  it('llms.txt does not list confirmed-dead routes', () => {
    for (const dead of CONFIRMED_DEAD) {
      expect(llmsPaths).not.toContain(dead);
    }
  });

  it('every sitemap loc resolves to a served slug or a SPA route', () => {
    const unresolved = sitemapPaths.filter((path) => !discoveryPathResolves(path));
    expect(unresolved).toEqual([]);
  });

  it('every docs.revealui.com link in llms.txt resolves to a served slug or a SPA route', () => {
    const unresolved = llmsPaths.filter((path) => !discoveryPathResolves(path));
    expect(unresolved).toEqual([]);
  });
});
