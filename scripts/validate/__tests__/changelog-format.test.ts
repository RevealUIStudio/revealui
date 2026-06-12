/**
 * Tests for changelog-format.ts
 *
 * The validator guards the changesets-owned layout of
 * packages/*\/CHANGELOG.md: line 1 must be the `# <package>` H1 (never a
 * frontmatter fence), and no docs-frontmatter keys may sit at column 0
 * outside fenced code. The corrupted fixture replicates the exact
 * 2026-06-12 (#1377) signature: changesets replaced the file's first
 * newline, injecting the new version section between the opening `---`
 * and the stranded frontmatter keys.
 */

import { describe, expect, it } from 'vitest';
import { checkChangelogText } from '../changelog-format.ts';

const FILE = 'packages/example/CHANGELOG.md';

function text(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

describe('checkChangelogText', () => {
  it('accepts a changesets-shaped changelog', () => {
    const clean = text([
      '# @revealui/example',
      '',
      '## 0.2.0',
      '',
      '### Minor Changes',
      '',
      '- abc1234: Add a thing.',
      '- def5678: Multi-line entry',
      '  with an indented continuation line.',
      '',
      '## 0.1.0',
      '',
      '### Patch Changes',
      '',
      '- 0123abc: Fix a thing.',
    ]);
    expect(checkChangelogText(clean, FILE)).toEqual([]);
  });

  it('flags a leading frontmatter fence with the prepend explanation', () => {
    const frontmattered = text([
      '---',
      'title: "@revealui/example"',
      'visibility: public',
      '---',
      '',
      '# @revealui/example',
      '',
      '## 0.1.0',
    ]);
    const violations = checkChangelogText(frontmattered, FILE);
    expect(violations.some((v) => v.line === 1 && v.problem.includes('frontmatter fence'))).toBe(
      true,
    );
    expect(violations.some((v) => v.problem.includes('title:'))).toBe(true);
  });

  it('flags the #1377 corruption signature (section injected inside frontmatter)', () => {
    const corrupted = text([
      '---',
      '',
      '## 0.10.0',
      '### Minor Changes',
      '',
      '- ebbe445: A release note.',
      'title: "@revealui/example"',
      'description: "junk derived from the first paragraph"',
      'visibility: public',
      'status: narrative',
      'audience: user',
      '---',
      '',
      '# @revealui/example',
      '',
      '## 0.9.0',
    ]);
    const violations = checkChangelogText(corrupted, FILE);
    expect(violations.some((v) => v.line === 1)).toBe(true);
    expect(violations.filter((v) => v.problem.includes('stranded')).length).toBe(5);
  });

  it('flags a first line that is neither the H1 nor a fence', () => {
    const headless = text(['## 0.1.0', '', '- abc1234: note']);
    const violations = checkChangelogText(headless, FILE);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.problem).toContain('# <package name>');
  });

  it('ignores frontmatter-shaped lines inside fenced code blocks', () => {
    const fenced = text([
      '# @revealui/example',
      '',
      '## 0.1.0',
      '',
      '- abc1234: Document config frontmatter:',
      '',
      '```yaml',
      'title: not frontmatter',
      'status: just an example',
      '```',
    ]);
    expect(checkChangelogText(fenced, FILE)).toEqual([]);
  });

  it('ignores indented continuations and mid-file horizontal rules', () => {
    const indented = text([
      '# @revealui/example',
      '',
      '## 0.1.0',
      '',
      '- abc1234: Entry',
      '  title: indented continuation, not frontmatter',
      '',
      '---',
      '',
      '## 0.0.1',
    ]);
    expect(checkChangelogText(indented, FILE)).toEqual([]);
  });
});
