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

interface BrandMeta {
  brand: { 'rvui-brand-light': string; 'rvui-brand-dark': string };
  type: Record<string, string>;
  shape: Record<string, string>;
  ladders: {
    note: string;
    dark: Record<string, string>;
    light: Record<string, string>;
  };
}

const META = JSON.parse(readFileSync(BRAND_META, 'utf8')) as BrandMeta;
const CSS = readFileSync(TOKENS_SRC, 'utf8');

/** tokens.css aligns values with extra spaces; collapse runs so the declared
 *  canon (single-spaced) matches regardless of alignment. No regex. */
const CSS_COLLAPSED = CSS.split('\n')
  .map((line) =>
    line
      .split(' ')
      .filter((part) => part !== '')
      .join(' '),
  )
  .join('\n');

function expectDeclaration(name: string, value: string): void {
  const declaration = `--rvui-${name}: ${value}`;
  expect(CSS_COLLAPSED.includes(declaration), `missing ${declaration}`).toBe(true);
}

// ---------------------------------------------------------------------------
// Color math — exact oklch() → WCAG relative luminance via OKLab → linear
// sRGB. Pure functions, no deps, no regex (string slicing + split only).
// Matrices: Björn Ottosson's OKLab reference implementation.
// Calibration: tokens.css documents brand-dark on surface-0-dark at 4.73:1
// and warning-text-dark at 7.45:1; this math reproduces both within ~1%.
// ---------------------------------------------------------------------------

function parseOklch(value: string): { L: number; C: number; h: number } {
  const open = value.indexOf('(');
  const close = value.lastIndexOf(')');
  if (open === -1 || close === -1) throw new Error(`not an oklch() value: ${value}`);
  const inner = value.slice(open + 1, close);
  if (inner.includes('/')) throw new Error(`declared canon must not carry alpha: ${value}`);
  const parts = inner.split(' ').filter((part) => part !== '');
  if (parts.length !== 3) throw new Error(`expected 3 oklch components: ${value}`);
  const L = Number(parts[0]);
  const C = Number(parts[1]);
  const h = Number(parts[2]);
  if (Number.isNaN(L) || Number.isNaN(C) || Number.isNaN(h)) {
    throw new Error(`non-numeric oklch components: ${value}`);
  }
  return { L, C, h };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** WCAG relative luminance of an oklch() color (sRGB-clamped). */
function relativeLuminance(value: string): number {
  const { L, C, h } = parseOklch(value);
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return 0.2126729 * r + 0.7151522 * g + 0.072175 * bl;
}

/** WCAG 1.4.3 contrast ratio between two oklch() colors. */
function contrast(fg: string, bg: string): number {
  const yFg = relativeLuminance(fg);
  const yBg = relativeLuminance(bg);
  const hi = Math.max(yFg, yBg);
  const lo = Math.min(yFg, yBg);
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens contract', () => {
  it('src/tokens.css contains the cobalt light brand value', () => {
    expect(CSS.includes(BRAND_LIGHT)).toBe(true);
  });

  it('src/tokens.css contains the cobalt dark brand value', () => {
    expect(CSS.includes(BRAND_DARK)).toBe(true);
  });

  it('brand-meta.json rvui-brand-light matches cobalt canon', () => {
    expect(META.brand['rvui-brand-light']).toBe(BRAND_LIGHT);
  });

  it('brand-meta.json rvui-brand-dark matches cobalt canon', () => {
    expect(META.brand['rvui-brand-dark']).toBe(BRAND_DARK);
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

describe('declared canon — tokens.css carries every brand-meta value', () => {
  // Declaration-level matching (name + value) pins the binding, not just the
  // value's presence somewhere in the file. Light and dark blocks share names
  // with different values; each declared value must exist as a declaration.
  it('typography stacks', () => {
    for (const [name, value] of Object.entries(META.type)) {
      expectDeclaration(name, value);
    }
  });

  it('radius scale', () => {
    for (const [name, value] of Object.entries(META.shape)) {
      expectDeclaration(name, value);
    }
  });

  it('dark surface/text ladder', () => {
    for (const [name, value] of Object.entries(META.ladders.dark)) {
      expectDeclaration(name, value);
    }
  });

  it('light surface/text ladder', () => {
    for (const [name, value] of Object.entries(META.ladders.light)) {
      expectDeclaration(name, value);
    }
  });
});

describe('contrast guards — WCAG AA invariants on the declared canon', () => {
  // The gray-500-on-dark failure class (pre-rebrand) shipped because no gate
  // computed contrast. These guards make the AA floor a CI invariant: any
  // future ladder tweak that re-breaks a pairing fails this suite.
  const dark = META.ladders.dark;
  const light = META.ladders.light;

  const AA_TEXT = 4.5;

  const aaPairs: Array<[string, string, string]> = [
    // dark mode — body + muted text on the layered surfaces
    ['dark text-0 on surface-0', dark['text-0'] ?? '', dark['surface-0'] ?? ''],
    ['dark text-0 on surface-1', dark['text-0'] ?? '', dark['surface-1'] ?? ''],
    ['dark text-0 on surface-2', dark['text-0'] ?? '', dark['surface-2'] ?? ''],
    ['dark text-1 on surface-0', dark['text-1'] ?? '', dark['surface-0'] ?? ''],
    ['dark text-1 on surface-1', dark['text-1'] ?? '', dark['surface-1'] ?? ''],
    ['dark text-2 on surface-0', dark['text-2'] ?? '', dark['surface-0'] ?? ''],
    // The historical failure pair: muted text on a card. Pre-remap gray-500
    // tested 4.19:1 here; the v4 ladder tests ~5.4:1.
    ['dark text-2 on surface-1', dark['text-2'] ?? '', dark['surface-1'] ?? ''],
    ['dark warning-text on surface-0', dark['warning-text'] ?? '', dark['surface-0'] ?? ''],
    ['dark success-text on surface-0', dark['success-text'] ?? '', dark['surface-0'] ?? ''],
    ['dark error-text on surface-0', dark['error-text'] ?? '', dark['surface-0'] ?? ''],
    // brand used as text/link on the page bg (tokens.css documents 4.73:1)
    ['dark brand on surface-0', BRAND_DARK, dark['surface-0'] ?? ''],
    // light mode
    ['light text-0 on surface-0', light['text-0'] ?? '', light['surface-0'] ?? ''],
    ['light text-0 on surface-1', light['text-0'] ?? '', light['surface-1'] ?? ''],
    ['light text-1 on surface-0', light['text-1'] ?? '', light['surface-0'] ?? ''],
    ['light text-1 on surface-1', light['text-1'] ?? '', light['surface-1'] ?? ''],
    ['light text-2 on surface-0', light['text-2'] ?? '', light['surface-0'] ?? ''],
    ['light text-2 on surface-1', light['text-2'] ?? '', light['surface-1'] ?? ''],
    ['light warning-text on surface-0', light['warning-text'] ?? '', light['surface-0'] ?? ''],
    ['light success-text on surface-0', light['success-text'] ?? '', light['surface-0'] ?? ''],
    ['light error-text on surface-0', light['error-text'] ?? '', light['surface-0'] ?? ''],
    ['light brand on surface-0', BRAND_LIGHT, light['surface-0'] ?? ''],
    // CTA labels — both modes hold AA against their primary brand fill after
    // the 2026-06-14 dark-mode ink swap. Light stays paper-white on cobalt-200
    // (~9.6:1). Dark moves to near-black ink (surface-0 value) on cobalt-300
    // (~4.69:1), clearing the floor the WCAG brand lift had pulled below AA.
    ['light text-on-brand on brand', light['text-on-brand'] ?? '', BRAND_LIGHT],
    ['dark text-on-brand on brand', dark['text-on-brand'] ?? '', BRAND_DARK],
  ];

  for (const [label, fg, bg] of aaPairs) {
    it(`${label} >= ${AA_TEXT}:1`, () => {
      const ratio = contrast(fg, bg);
      expect(ratio, `${label} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }
});
