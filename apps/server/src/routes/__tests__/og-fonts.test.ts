import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { describe, expect, it } from 'vitest';

/**
 * Real-font regression guard for /api/og.
 *
 * Unlike og.test.ts (which mocks satori), this suite feeds the REAL committed
 * font files to the REAL satori engine. It reproduces the production failure
 * mode: a *variable* Inter Tight font made satori's @shuding/opentype.js fork
 * throw "Cannot read properties of undefined (reading '272')" at parseFvarAxis
 * while parsing the `fvar` table. Static single-weight instances have no `fvar`
 * table, so parsing succeeds.
 *
 * Fonts are read via readFileSync, NOT an ESM import, so the vitest `.ttf`
 * alias (-> binary-stub.ts) does not apply — these are the actual bytes that
 * tsup inlines into the production bundle.
 */

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const regular = readFileSync(join(fontsDir, 'InterTight-Regular.ttf'));
const bold = readFileSync(join(fontsDir, 'InterTight-Bold.ttf'));

const fonts = [
  { name: 'Inter Tight', data: regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter Tight', data: bold, weight: 700 as const, style: 'normal' as const },
];

/** Minimal satori node exercising both weights, mirroring og.ts's card. */
function card(): Parameters<typeof satori>[0] {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        fontFamily: 'Inter Tight',
      },
      children: [
        { type: 'div', props: { style: { fontSize: 72, fontWeight: 700 }, children: 'RevealUI' } },
        {
          type: 'div',
          props: {
            style: { fontSize: 32, fontWeight: 400 },
            children: 'Build a business your agents can run.',
          },
        },
      ],
    },
  } as unknown as Parameters<typeof satori>[0];
}

/**
 * Scan an sfnt (TrueType/OpenType) table directory for a 4-byte tag without a
 * font parser or regex. sfnt header: numTables at offset 4 (uint16 BE), then
 * 16-byte table records from offset 12, each starting with its 4-byte tag.
 */
function hasSfntTable(font: Buffer, tag: string): boolean {
  const numTables = font.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const recordOffset = 12 + i * 16;
    if (font.toString('latin1', recordOffset, recordOffset + 4) === tag) {
      return true;
    }
  }
  return false;
}

describe('OG fonts — real satori parse', () => {
  it('renders an SVG from the static Inter Tight instances (no variable-font fvar crash)', async () => {
    const svg = await satori(card(), { width: 1200, height: 630, fonts });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    // satori renders glyphs as vector <path> elements; a real font + text yields many.
    expect(svg).toContain('<path');
    expect(svg.length).toBeGreaterThan(1000);
  });

  it('ships static (non-variable) fonts — the bundled files have no fvar table', () => {
    expect(hasSfntTable(regular, 'fvar')).toBe(false);
    expect(hasSfntTable(bold, 'fvar')).toBe(false);
  });
});
