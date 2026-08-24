/**
 * Host-level SPA fallback must not rewrite missing `.md` / `.mdx` fetches
 * to index.html. That rewrite is what painted `<!DOCTYPE html>` as article
 * text. REGEX-CONFIG-BOUNDARY: Vercel `source` patterns are path-to-regexp.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const vercel = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../vercel.json'), 'utf8'),
) as {
  rewrites?: Array<{ source: string; destination: string }>;
  redirects?: Array<{ source: string; destination: string }>;
};

describe('docs vercel.json SPA rewrite', () => {
  it('does not catch-all rewrite markdown fetches to index.html', () => {
    const rewrites = vercel.rewrites ?? [];
    const spa = rewrites.filter((rule) => rule.destination === '/index.html');
    expect(spa.length).toBeGreaterThan(0);
    for (const rule of spa) {
      expect(rule.source.includes('md')).toBe(true);
    }
    expect(
      rewrites.some((rule) => rule.source === '/(.*)' && rule.destination === '/index.html'),
    ).toBe(false);
  });

  it('retargets dead /reference package slugs and /contact', () => {
    const redirects = vercel.redirects ?? [];
    const bySource = new Map(redirects.map((rule) => [rule.source, rule.destination]));
    expect(bySource.get('/contact')).toBe('https://revealui.com/contact');
    expect(bySource.get('/reference/ai')).toBe('/ai');
    expect(bySource.get('/reference/auth')).toBe('/auth');
    expect(bySource.get('/reference/db')).toBe('/database');
  });
});
