import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const brandDir = path.resolve(process.cwd(), 'src/assets/brand');

function readBrand(name: string): string {
  return readFileSync(path.join(brandDir, name), 'utf8');
}

const STEM = 'M172,150 Q207,159 242,150';
const BOWL = 'M242,150 L300,143';
const LEG = 'M219.6,335.1';
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
const MASTER_TRANSFORM = 'translate(256,256) scale(1.06) translate(-290,-320)';
const SCYTHE_CLIP = 'M219.6,335.1';
const SCYTHE_TIP = '488.0,484.0';

describe('Circuit-R brand family', () => {
  it('keeps revealui-logo.svg as the only circuit master', () => {
    const master = readBrand('revealui-logo.svg');
    expect(existsSync(path.join(brandDir, 'revealui-logo-dark.svg'))).toBe(false);
    expect(master.includes(MASTER_SCALE)).toBe(true);
    expect(master.includes(MASTER_TRANSFORM)).toBe(true);
    expect(master.includes(STEM)).toBe(true);
    expect(master.includes(BOWL)).toBe(true);
    expect(master.includes(LEG)).toBe(true);
    expect(master.includes(SCYTHE_CLIP)).toBe(true);
    expect(master.includes(SCYTHE_TIP)).toBe(true);
    expect(master.includes('translate(-330,-320)')).toBe(false);
    expect(master.includes(NAVY_STEM)).toBe(true);
    expect(master.includes(NAVY_BOWL)).toBe(true);
    expect(master.includes(NAVY_LEG)).toBe(true);
    expect(master.includes(FROST_TRACE)).toBe(true);
    expect(master.includes(AMBER_VIA)).toBe(true);
    expect(master.includes('<circle')).toBe(true);
    expect(master.includes(FACETED_A)).toBe(false);
    expect(master.includes(FACETED_B)).toBe(false);
    expect(master.includes('fill="#dfeeff" fill-rule="evenodd"')).toBe(false);
  });

  it('uses the same 3 region paths, with no traces, on the flat small marks', () => {
    const mark = readBrand('revealui-mark.svg');
    const favicon = readBrand('favicon.svg');
    expect(mark).toBe(favicon);
    expect(mark.includes(STEM)).toBe(true);
    expect(mark.includes(BOWL)).toBe(true);
    expect(mark.includes(LEG)).toBe(true);
    expect(mark.includes(NAVY_STEM)).toBe(true);
    expect(mark.includes(NAVY_BOWL)).toBe(true);
    expect(mark.includes(NAVY_LEG)).toBe(true);
    expect(mark.includes('<circle')).toBe(false);
    expect(mark.includes(FROST_TRACE)).toBe(false);
    expect(mark.includes(FACETED_A)).toBe(false);
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
      expect(tiled.includes(LEG)).toBe(true);
      expect(tiled.includes(NAVY_STEM)).toBe(true);
      expect(tiled.includes(FROST_TRACE)).toBe(true);
      expect(tiled.includes(AMBER_VIA)).toBe(true);
      expect(tiled.includes('<circle')).toBe(true);
      expect(tiled.includes('#1e57a8')).toBe(false);
      expect(tiled.includes(FACETED_A)).toBe(false);
    }

    expect(iconMark.includes('rx="112"')).toBe(true);
    expect(maskable.includes('rx="0"')).toBe(true);
    expect(master.includes('<circle')).toBe(true);
  });

  it('keeps the mono mark on this R with currentColor', () => {
    const mono = readBrand('revealui-mark-mono.svg');
    expect(mono.includes(STEM)).toBe(true);
    expect(mono.includes(BOWL)).toBe(true);
    expect(mono.includes(LEG)).toBe(true);
    expect(mono.includes('currentColor')).toBe(true);
    expect(mono.includes('#003d94')).toBe(false);
    expect(mono.includes(FACETED_A)).toBe(false);
  });

  it('keeps wordmarks on this R with outlined RevealUI type', () => {
    const light = readBrand('wordmark-light.svg');
    const dark = readBrand('wordmark-dark.svg');
    for (const wordmark of [light, dark]) {
      expect(wordmark.includes(STEM)).toBe(true);
      expect(wordmark.includes(BOWL)).toBe(true);
      expect(wordmark.includes(LEG)).toBe(true);
      expect(wordmark.includes(FACETED_A)).toBe(false);
      expect(wordmark.includes('<text')).toBe(false);
    }
    expect(light.includes(NAVY_STEM)).toBe(true);
    expect(light.includes(NAVY_BOWL)).toBe(true);
    expect(light.includes(NAVY_LEG)).toBe(true);
  });
});
