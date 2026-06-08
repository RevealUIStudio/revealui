import { describe, expect, it } from 'vitest';
import { formatJson, formatText } from '../report';
import type { Finding } from '../scan';

const findings: Finding[] = [
  { tag: 'abs-home-path', file: 'a.ts', line: 3, reason: 'home path', content: '/home/alice/x' },
];

describe('formatText', () => {
  it('renders a [LEAK:tag] file:line header and the content', () => {
    const out = formatText(findings);
    expect(out).toContain('[LEAK:abs-home-path] a.ts:3');
    expect(out).toContain('/home/alice/x');
  });
  it('is empty for no findings', () => {
    expect(formatText([])).toBe('');
  });
});

describe('formatJson', () => {
  it('emits a parseable violations count + entries', () => {
    const parsed = JSON.parse(formatJson(findings));
    expect(parsed.violations).toBe(1);
    expect(parsed.entries[0].tag).toBe('abs-home-path');
  });
  it('reports zero for no findings', () => {
    expect(JSON.parse(formatJson([])).violations).toBe(0);
  });
});
