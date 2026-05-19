import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');
const TOKENS_SRC = join(PKG_ROOT, 'src', 'tokens.css');
const BRAND_META = join(PKG_ROOT, 'design-context', 'brand-meta.json');
const MANIFEST = join(PKG_ROOT, 'design-context', 'MANIFEST.sha256');

const BRAND_LIGHT = 'oklch(0.36 0.190 240)';
const BRAND_DARK = 'oklch(0.58 0.150 240)';

describe('tokens contract', () => {
  it('src/tokens.css contains the cobalt light brand value', () => {
    const css = readFileSync(TOKENS_SRC, 'utf8');
    expect(css.includes(BRAND_LIGHT)).toBe(true);
  });

  it('src/tokens.css contains the cobalt dark brand value', () => {
    const css = readFileSync(TOKENS_SRC, 'utf8');
    expect(css.includes(BRAND_DARK)).toBe(true);
  });

  it('brand-meta.json rvui-brand-light matches cobalt canon', () => {
    const meta = JSON.parse(readFileSync(BRAND_META, 'utf8')) as {
      brand: { 'rvui-brand-light': string; 'rvui-brand-dark': string };
    };
    expect(meta.brand['rvui-brand-light']).toBe(BRAND_LIGHT);
  });

  it('brand-meta.json rvui-brand-dark matches cobalt canon', () => {
    const meta = JSON.parse(readFileSync(BRAND_META, 'utf8')) as {
      brand: { 'rvui-brand-light': string; 'rvui-brand-dark': string };
    };
    expect(meta.brand['rvui-brand-dark']).toBe(BRAND_DARK);
  });

  it('MANIFEST.sha256 matches sha256(src/tokens.css) — pack is in sync', () => {
    const tokensSrc = readFileSync(TOKENS_SRC);
    const actual = createHash('sha256').update(tokensSrc).digest('hex');

    const manifestLine = readFileSync(MANIFEST, 'utf8').trim();
    // Format is "<digest>  tokens.css" — take the first whitespace-delimited token
    const committed = manifestLine.split(' ')[0];

    expect(committed).toBe(actual);
  });
});
