import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const brandDir = path.resolve(process.cwd(), 'src/assets/brand');

function readBrand(name: string): string {
  return readFileSync(path.join(brandDir, name), 'utf8');
}

const STEM = 'M172,150 Q207,159 242,150';
const BOWL = 'M242,150 L300,143';
const SCYTHE_TIP = '488.0,484.0';
const SCYTHE_LEG = 'M219.6,335.1';
const FACETED_A = 'M26 50';
const FACETED_B = 'M34 11';
const NAVY_STEM = '#0a2c5a';
const NAVY_BOWL = '#002247';
const NAVY_LEG = '#0e3468';
const FROST_TRACE = '#9fc9ff';
const AMBER_VIA = '#f0b519';
const NAVY_PLATE = '#060d1a';
const TILE_SCALE = 'scale(0.742)';
const MASTER_SCALE = 'scale(1.06)';
const WHITE_PLATE = 'fill="#ffffff"';
const WHITE_PLATE_SHORT = 'fill="#fff"';

/** Stem bar in design space. */
const STEM_LEFT_X = 172;
const STEM_AXIS_X = 207;
const STEM_AXIS_Y = 320.5;
const BOWL_RIGHT_X = 446;
const CANVAS_CENTER = 256;

function applyMasterTransform(x: number, y: number, svg: string): { x: number; y: number } {
  const key = 'transform="';
  const start = svg.indexOf(key);
  if (start === -1) {
    throw new Error('master is missing a transform');
  }
  const from = start + key.length;
  const end = svg.indexOf('"', from);
  const transform = svg.slice(from, end);
  return applyTranslateScaleTranslate(x, y, transform);
}

/**
 * Apply `translate(cx,cy) scale(s) translate(-ox,-oy)` without a regex.
 * That is the only transform the Circuit-R master is allowed to carry.
 */
function applyTranslateScaleTranslate(
  x: number,
  y: number,
  transform: string,
): { x: number; y: number } {
  const nums: number[] = [];
  let i = 0;
  while (i < transform.length) {
    const c = transform[i];
    const starts = c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9');
    if (!starts) {
      i += 1;
      continue;
    }
    const begin = i;
    if (c === '-' || c === '+') i += 1;
    while (i < transform.length && transform[i] >= '0' && transform[i] <= '9') i += 1;
    if (transform[i] === '.') {
      i += 1;
      while (i < transform.length && transform[i] >= '0' && transform[i] <= '9') i += 1;
    }
    nums.push(Number(transform.slice(begin, i)));
  }
  if (nums.length !== 5) {
    throw new Error(`expected translate/scale/translate, got ${String(nums.length)} numbers`);
  }
  const [cx, cy, scale, ox, oy] = nums;
  return {
    x: (x + ox) * scale + cx,
    y: (y + oy) * scale + cy,
  };
}

function extractClipPath(svg: string, id: string): string {
  const needle = `clipPath id="${id}"`;
  const at = svg.indexOf(needle);
  if (at === -1) {
    throw new Error(`missing clipPath ${id}`);
  }
  const dKey = ' d="';
  const dAt = svg.indexOf(dKey, at);
  const from = dAt + dKey.length;
  const to = svg.indexOf('"', from);
  return svg.slice(from, to);
}

function pathMaxX(d: string): number {
  let max = Number.NEGATIVE_INFINITY;
  let i = 0;
  while (i < d.length) {
    const c = d[i];
    const starts = c === '-' || c === '.' || (c >= '0' && c <= '9');
    if (!starts) {
      i += 1;
      continue;
    }
    const begin = i;
    if (c === '-') i += 1;
    while (i < d.length && d[i] >= '0' && d[i] <= '9') i += 1;
    if (d[i] === '.') {
      i += 1;
      while (i < d.length && d[i] >= '0' && d[i] <= '9') i += 1;
    }
    const n = Number(d.slice(begin, i));
    // x is the first of each comma-pair in this authored path dialect
    if (i < d.length && d[i] === ',') {
      if (n > max) max = n;
    }
  }
  return max;
}

describe('Circuit-R brand family', () => {
  it('keeps revealui-logo.svg as the only optical-center circuit master', () => {
    const master = readBrand('revealui-logo.svg');
    expect(existsSync(path.join(brandDir, 'revealui-logo-dark.svg'))).toBe(false);
    expect(master.includes(MASTER_SCALE)).toBe(true);
    expect(master.includes(STEM)).toBe(true);
    expect(master.includes(BOWL)).toBe(true);
    expect(master.includes(NAVY_STEM)).toBe(true);
    expect(master.includes(NAVY_BOWL)).toBe(true);
    expect(master.includes(NAVY_LEG)).toBe(true);
    expect(master.includes(FROST_TRACE)).toBe(true);
    expect(master.includes(AMBER_VIA)).toBe(true);
    expect(master.includes('<circle')).toBe(true);
    expect(master.includes(FACETED_A)).toBe(false);
    expect(master.includes(FACETED_B)).toBe(false);
    expect(master.includes('fill="#dfeeff" fill-rule="evenodd"')).toBe(false);
    expect(master.includes(WHITE_PLATE)).toBe(false);
    expect(master.includes(WHITE_PLATE_SHORT)).toBe(false);
    expect(master.includes(SCYTHE_TIP)).toBe(false);
    expect(master.includes(SCYTHE_LEG)).toBe(false);
  });

  it('places the letter on the optical center of the 512 square', () => {
    const master = readBrand('revealui-logo.svg');
    const stemLeft = applyMasterTransform(STEM_LEFT_X, STEM_AXIS_Y, master);
    const stemAxis = applyMasterTransform(STEM_AXIS_X, STEM_AXIS_Y, master);
    const bowlRight = applyMasterTransform(BOWL_RIGHT_X, STEM_AXIS_Y, master);
    const massMid = (stemLeft.x + bowlRight.x) / 2;

    // Scythe-leg parked the stem near canvas x=88. Optical-center sits it inward.
    expect(stemLeft.x).toBeGreaterThan(120);
    expect(stemAxis.x).toBeGreaterThan(150);
    expect(stemAxis.x).toBeLessThan(230);
    // Letter spans both halves of the square — mass is not left-parked.
    expect(stemLeft.x).toBeLessThan(CANVAS_CENTER);
    expect(bowlRight.x).toBeGreaterThan(CANVAS_CENTER);
    expect(bowlRight.x).toBeLessThan(500);
    expect(massMid).toBeGreaterThan(240);
    expect(massMid).toBeLessThan(310);
    expect(stemAxis.y).toBeGreaterThan(CANVAS_CENTER - 12);
    expect(stemAxis.y).toBeLessThan(CANVAS_CENTER + 12);
  });

  it('stops the leg under the bowl, not as a scythe sweep', () => {
    const master = readBrand('revealui-logo.svg');
    const bowl = extractClipPath(master, 'cb');
    const leg = extractClipPath(master, 'cl');
    const bowlRight = pathMaxX(bowl);
    const legRight = pathMaxX(leg);
    expect(legRight).toBeLessThanOrEqual(bowlRight + 2);
    expect(legRight).toBeLessThan(450);
  });

  it('uses the same 3 region paths, with no traces, on the flat small marks', () => {
    const mark = readBrand('revealui-mark.svg');
    const favicon = readBrand('favicon.svg');
    const master = readBrand('revealui-logo.svg');
    const masterLeg = extractClipPath(master, 'cl');
    expect(mark).toBe(favicon);
    expect(mark.includes(STEM)).toBe(true);
    expect(mark.includes(BOWL)).toBe(true);
    expect(mark.includes(masterLeg.slice(0, 24))).toBe(true);
    expect(mark.includes(NAVY_STEM)).toBe(true);
    expect(mark.includes(NAVY_BOWL)).toBe(true);
    expect(mark.includes(NAVY_LEG)).toBe(true);
    expect(mark.includes('<circle')).toBe(false);
    expect(mark.includes(FROST_TRACE)).toBe(false);
    expect(mark.includes(FACETED_A)).toBe(false);
    expect(mark.includes(SCYTHE_TIP)).toBe(false);
  });

  it('tiles the same circuit letter on a navy plate, inset for a circular crop', () => {
    const iconMark = readBrand('icon-mark.svg');
    const maskable = readBrand('icon-maskable.svg');
    const master = readBrand('revealui-logo.svg');

    for (const tiled of [iconMark, maskable]) {
      expect(tiled.includes(NAVY_PLATE)).toBe(true);
      expect(tiled.includes(TILE_SCALE)).toBe(true);
      expect(tiled.includes(MASTER_SCALE)).toBe(false);
      expect(tiled.includes(STEM)).toBe(true);
      expect(tiled.includes(BOWL)).toBe(true);
      expect(tiled.includes(NAVY_STEM)).toBe(true);
      expect(tiled.includes(FROST_TRACE)).toBe(true);
      expect(tiled.includes(AMBER_VIA)).toBe(true);
      expect(tiled.includes('<circle')).toBe(true);
      expect(tiled.includes('#1e57a8')).toBe(false);
      expect(tiled.includes(FACETED_A)).toBe(false);
      expect(tiled.includes(SCYTHE_TIP)).toBe(false);
      expect(tiled.includes(WHITE_PLATE)).toBe(false);
    }

    expect(iconMark.includes('rx="112"')).toBe(true);
    expect(maskable.includes('rx="0"')).toBe(true);
    expect(master.includes('<circle')).toBe(true);
  });

  it('keeps the mono mark on this R with currentColor', () => {
    const mono = readBrand('revealui-mark-mono.svg');
    const master = readBrand('revealui-logo.svg');
    const masterLeg = extractClipPath(master, 'cl');
    expect(mono.includes(STEM)).toBe(true);
    expect(mono.includes(BOWL)).toBe(true);
    expect(mono.includes(masterLeg.slice(0, 24))).toBe(true);
    expect(mono.includes('currentColor')).toBe(true);
    expect(mono.includes('#003d94')).toBe(false);
    expect(mono.includes(FACETED_A)).toBe(false);
    expect(mono.includes(SCYTHE_TIP)).toBe(false);
  });

  it('keeps wordmarks on this R with outlined RevealUI type', () => {
    const light = readBrand('wordmark-light.svg');
    const dark = readBrand('wordmark-dark.svg');
    const master = readBrand('revealui-logo.svg');
    const masterLeg = extractClipPath(master, 'cl');
    for (const wordmark of [light, dark]) {
      expect(wordmark.includes(STEM)).toBe(true);
      expect(wordmark.includes(BOWL)).toBe(true);
      expect(wordmark.includes(masterLeg.slice(0, 24))).toBe(true);
      expect(wordmark.includes(FACETED_A)).toBe(false);
      expect(wordmark.includes('<text')).toBe(false);
      expect(wordmark.includes(SCYTHE_TIP)).toBe(false);
    }
    expect(light.includes(NAVY_STEM)).toBe(true);
    expect(light.includes(NAVY_BOWL)).toBe(true);
    expect(light.includes(NAVY_LEG)).toBe(true);
  });
});
