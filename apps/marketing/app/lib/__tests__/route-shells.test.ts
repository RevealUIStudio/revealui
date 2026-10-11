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
} from '../html-shell';
import { MARKETING_ROUTE_HEADS, marketingCanonical } from '../route-heads';
import { assertMarketingSitemapShells, marketingShellPlan } from '../write-marketing-shells.server';

const indexHtml = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('marketing route shells', () => {
  const shells = marketingShellPlan();
  const sitemap = extractLocs(
    readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf8'),
  );

  it('lists /products and /security because both are real pages', () => {
    expect(MARKETING_ROUTE_HEADS.map((head) => head.path)).toEqual(
      expect.arrayContaining(['/products', '/security']),
    );
    expect(sitemap).toEqual(
      expect.arrayContaining(['https://revealui.com/products', 'https://revealui.com/security']),
    );
  });

  it('sets each sitemap canonical equal to that route URL', () => {
    expect(() => assertMarketingSitemapShells(sitemap, shells, new Set())).not.toThrow();
    for (const shell of shells) {
      expect(shell.head.canonical).toBe(marketingCanonical(shell.path));
    }
  });

  it('writes self-referencing social tags into the HTML shell', () => {
    const pricing = shells.find((shell) => shell.path === '/pricing');
    if (!pricing) {
      throw new Error('pricing shell missing');
    }
    const html = applyHtmlShell(indexHtml, pricing.head);
    expect(readTitle(html)).toBe('Pricing | RevealUI');
    expect(readCanonicalHref(html)).toBe('https://revealui.com/pricing');
    expect(readMetaContent(html, 'property', 'og:url')).toBe('https://revealui.com/pricing');
    expect(readMetaContent(html, 'property', 'og:title')).toBe('Pricing | RevealUI');
    expect(readMetaContent(html, 'name', 'twitter:title')).toBe('Pricing | RevealUI');
    expect(readMetaContent(html, 'name', 'description')).toContain('Free, Pro, Max');
  });

  it('serves the 404 shell with noindex and no canonical', () => {
    const html = applyHtmlShell(indexHtml, {
      title: '404 | RevealUI',
      description: "The page you're looking for doesn't exist or has moved.",
      canonical: null,
      robots: 'noindex',
    });
    expect(readTitle(html)).toBe('404 | RevealUI');
    expect(readCanonicalHref(html)).toBeNull();
    expect(readMetaContent(html, 'property', 'og:url')).toBeNull();
    expect(readRobots(html)).toBe('noindex');
  });
});
