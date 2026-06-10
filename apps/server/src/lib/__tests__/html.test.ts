import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../html.js';

describe('escapeHtml', () => {
  it('escapes all five HTML special characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes & first so replacement-inserted entities are not double-escaped', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
  });

  it('re-escapes already-escaped input (not idempotent, by design)', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes a script-injection payload', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes apostrophes as &#39;', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('leaves forward slashes alone (narrower than @revealui/core escapeHtml)', () => {
    expect(escapeHtml('</p>')).toBe('&lt;/p&gt;');
  });

  it('passes through strings without special characters', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    expect(escapeHtml('')).toBe('');
  });
});
