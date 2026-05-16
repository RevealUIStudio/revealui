import { describe, expect, it } from 'vitest';
import { tokenize } from '../tokenize.js';

describe('tokenize', () => {
  it('classifies plain words as word kind', () => {
    const tokens = tokenize('hello world');
    expect(tokens.filter((t) => t.kind === 'word').map((t) => t.text)).toEqual(['hello', 'world']);
  });

  it('classifies whitespace correctly', () => {
    const tokens = tokenize('a b');
    const ws = tokens.find((t) => t.kind === 'whitespace');
    expect(ws).toBeDefined();
    expect(ws?.text).toBe(' ');
  });

  it('classifies punctuation as symbol', () => {
    const tokens = tokenize('hello!');
    const sym = tokens.find((t) => t.kind === 'symbol');
    expect(sym).toBeDefined();
    expect(sym?.text).toBe('!');
  });

  it('records correct character offsets', () => {
    const tokens = tokenize('foo bar');
    const foo = tokens.find((t) => t.text === 'foo');
    const bar = tokens.find((t) => t.text === 'bar');
    expect(foo?.offset).toBe(0);
    expect(bar?.offset).toBe(4);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('handles digits as word-like tokens', () => {
    const tokens = tokenize('99 packages');
    const nums = tokens.filter((t) => t.kind === 'word');
    expect(nums[0].text).toBe('99');
  });

  it('handles dollar sign as symbol', () => {
    const tokens = tokenize('$100');
    expect(tokens[0].kind).toBe('symbol');
    expect(tokens[0].text).toBe('$');
  });

  it('splits auto-scaling on hyphen — Intl.Segmenter treats each part as word-like', () => {
    const tokens = tokenize('auto-scaling');
    const wordTexts = tokens.filter((t) => t.kind === 'word').map((t) => t.text);
    expect(wordTexts).toContain('auto');
    expect(wordTexts).toContain('scaling');
  });

  it('splits sign-on — both parts are word-like', () => {
    const tokens = tokenize('single sign-on');
    const wordTexts = tokens.filter((t) => t.kind === 'word').map((t) => t.text);
    expect(wordTexts).toContain('single');
    expect(wordTexts).toContain('sign');
    expect(wordTexts).toContain('on');
  });

  it('splits air-gapped — both parts are word-like', () => {
    const tokens = tokenize('air-gapped');
    const wordTexts = tokens.filter((t) => t.kind === 'word').map((t) => t.text);
    expect(wordTexts).toContain('air');
    expect(wordTexts).toContain('gapped');
  });

  it('splits on-prem — both parts are word-like', () => {
    const tokens = tokenize('on-prem');
    const wordTexts = tokens.filter((t) => t.kind === 'word').map((t) => t.text);
    expect(wordTexts).toContain('on');
    expect(wordTexts).toContain('prem');
  });

  it('handles multi-byte characters without crashing', () => {
    const tokens = tokenize('café résumé');
    expect(tokens.length).toBeGreaterThan(0);
    const words = tokens.filter((t) => t.kind === 'word');
    expect(words.length).toBeGreaterThan(0);
  });

  it('handles emoji without crashing', () => {
    const tokens = tokenize('hello 🎉 world');
    expect(tokens.length).toBeGreaterThan(0);
    const words = tokens.filter((t) => t.kind === 'word').map((t) => t.text);
    expect(words).toContain('hello');
    expect(words).toContain('world');
  });

  it('offset of first token is 0', () => {
    const tokens = tokenize('test');
    expect(tokens[0].offset).toBe(0);
  });

  it('tokens cover consecutive ranges', () => {
    const text = 'foo bar baz';
    const tokens = tokenize(text);
    for (const t of tokens) {
      expect(text.slice(t.offset, t.offset + t.text.length)).toBe(t.text);
    }
  });
});
