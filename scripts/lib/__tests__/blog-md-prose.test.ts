import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractBlogMdProseUnits } from '../blog-md-prose.js';

describe('extractBlogMdProseUnits', () => {
  it('skips fenced code and keeps paragraph prose', () => {
    const md = [
      '# Hello world this is a long enough heading',
      '',
      'This is a normal paragraph with enough characters to count as prose.',
      '',
      '```ts',
      'const secret = "not prose"',
      '```',
      '',
      'After the fence we still have a second long enough paragraph here.',
    ].join('\n');
    const units = extractBlogMdProseUnits(md);
    expect(units.some((u) => u.includes('not prose'))).toBe(false);
    expect(units.some((u) => u.includes('normal paragraph'))).toBe(true);
    expect(units.some((u) => u.includes('second long enough'))).toBe(true);
  });

  it('extracts list items as their own units when long enough', () => {
    const md = [
      '- Short',
      '- This list item is long enough to qualify as a standalone prose unit.',
    ].join('\n');
    const units = extractBlogMdProseUnits(md);
    expect(units).toContain('This list item is long enough to qualify as a standalone prose unit.');
    expect(units.some((u) => u === 'Short')).toBe(false);
  });

  it('reads real newest post without throwing', () => {
    const path = join(process.cwd(), 'docs/blog/18-open-runtime-for-fde-work.md');
    // When run from packages/* cwd differs; try monorepo root paths.
    let md: string;
    try {
      md = readFileSync(path, 'utf8');
    } catch {
      md = readFileSync(
        join(process.cwd(), '../../docs/blog/18-open-runtime-for-fde-work.md'),
        'utf8',
      );
    }
    const units = extractBlogMdProseUnits(md);
    expect(units.length).toBeGreaterThan(5);
  });
});
