import { describe, expect, it } from 'vitest';
import { extractExcerpt, extractTitle, listSearchDocPaths } from '../../app/lib/search-index';

describe('extractTitle', () => {
  it('returns the first ATX H1', () => {
    expect(extractTitle('# Hello World\n\nbody text')).toBe('Hello World');
  });

  it('ignores h2+ and bare hashes, finding the real H1', () => {
    expect(extractTitle('## Subhead\n\n# Real Title')).toBe('Real Title');
  });

  it('returns an empty string when there is no H1', () => {
    expect(extractTitle('no heading here\njust prose')).toBe('');
  });
});

describe('extractExcerpt', () => {
  it('uses the first substantive paragraph, stripping links and emphasis', () => {
    const md = '# Title\n\nSee the [admin guide](./ADMIN_GUIDE.md) for **bold** `code`.';
    expect(extractExcerpt(md)).toBe('See the admin guide for bold code.');
  });

  it('skips headings, rules, tables, and fenced code blocks', () => {
    const md = [
      '# T',
      '',
      '---',
      '',
      '```',
      'this is a long line of code that should be skipped entirely',
      '```',
      '',
      'The real paragraph text.',
    ].join('\n');
    expect(extractExcerpt(md)).toBe('The real paragraph text.');
  });

  it('truncates to maxLength with an ellipsis', () => {
    const out = extractExcerpt(`# T\n\n${'x'.repeat(200)}`, 50);
    expect(out.endsWith('...')).toBe(true);
    expect(out.length).toBe(53);
  });
});

describe('listSearchDocPaths (H2 coverage regression lock)', () => {
  const slugs = new Set(listSearchDocPaths().map(([slug]) => slug));

  it('includes nested-section and hyphenated docs the old INDEX.md regex dropped', () => {
    // The previous `[A-Z_]+.md` INDEX.md scrape matched neither of these.
    expect(slugs.has('guides/deployment')).toBe(true);
    expect(slugs.has('environment-variables-guide')).toBe(true);
  });

  it('covers far more than the ~26 uppercase INDEX.md entries', () => {
    expect(listSearchDocPaths().length).toBeGreaterThan(40);
  });
});
