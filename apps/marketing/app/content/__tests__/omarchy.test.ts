/**
 * Honesty gate for the Omarchy runtime-template blurb.
 * Pins Brand copy and forbids SKU / exclusivity / sister-product sales language.
 */
import { describe, expect, it } from 'vitest';
import { OMARCHY } from '../omarchy';

const FORBIDDEN = [
  'RevDev',
  'RevForge',
  'RevKit',
  'RevealFleet',
  'CapCut',
  'Railway',
  '$3500',
  '$3,500',
  '$3.500',
] as const;

function blob(): string {
  return JSON.stringify(OMARCHY);
}

describe('Omarchy template/plugin blurb', () => {
  it('pins Brand SSOT title, eyebrow, and blurbs', () => {
    expect(OMARCHY.title).toBe('Omarchy');
    expect(OMARCHY.eyebrow).toBe('Runtime template · Host plugin');
    expect(OMARCHY.shortBlurb).toBe(
      'Runs great on Omarchy. Also Ubuntu, WSL, and macOS. A dogfood path for self-hosting the RevealUI business runtime.',
    );
    expect(OMARCHY.longer).toBe(
      'Omarchy is a RevealUI runtime template for Omarchy Quattro users. Point inference at an OpenAI-compatible or Ollama URL, or at Ubuntu Inference Snaps already running on a host. This template does not reimplement snaps on Arch. It is a template, not a cash-ladder SKU and not required for Proof Sprint or Launch.',
    );
  });

  it('includes the Brand checklist and does-not-include bounds', () => {
    expect(OMARCHY.includes).toEqual([
      'Docker and create-revealui install recipe',
      'OpenAI-compatible or Ollama URL wiring',
      'stream-safe tip for screen share',
      'tested target: Omarchy Quattro',
      'supported on Ubuntu, WSL, and macOS',
    ]);
    expect(OMARCHY.doesNotInclude).toEqual([
      'Omarchy as a required host',
      'Ubuntu inference snaps reimplemented on Arch',
      'a fourth public price SKU',
    ]);
  });

  it('is labeled as a template/plugin, not a live paid SKU', () => {
    expect(OMARCHY.kind).toBe('template-plugin');
    expect(OMARCHY.sku).toBeNull();
    expect(Object.hasOwn(OMARCHY, 'price')).toBe(false);
    expect(OMARCHY.eyebrow.toLowerCase().includes('template')).toBe(true);
    expect(OMARCHY.longer.includes('It is a template')).toBe(true);
    expect(OMARCHY.doesNotInclude.includes('a fourth public price SKU')).toBe(true);
    expect(OMARCHY.doesNotInclude.includes('Omarchy as a required host')).toBe(true);
  });

  it('points at the runtime skeleton path, not a checkout SKU', () => {
    expect(OMARCHY.sourcePath).toBe('templates/omarchy');
    expect(OMARCHY.sourceLabel).toBe('Source: templates/omarchy/');
    expect(Object.hasOwn(OMARCHY, 'docsHref')).toBe(false);
    expect(Object.hasOwn(OMARCHY, 'checkoutHref')).toBe(false);
    expect(OMARCHY.sourcePath.startsWith('http')).toBe(false);
    expect(OMARCHY.sourceLabel.includes('$')).toBe(false);
  });

  it('does not sell sister products, CapCut, Railway, or a $3500 SKU', () => {
    const text = blob();
    for (const phrase of FORBIDDEN) {
      expect(text.includes(phrase), `omarchy copy must not include ${phrase}`).toBe(false);
    }
    expect(text.includes('Fleet $')).toBe(false);
    expect(Object.hasOwn(OMARCHY, 'checkoutHref')).toBe(false);
  });

  it('does not use an em dash (marketing-voice house style)', () => {
    expect(blob().includes('\u2014')).toBe(false);
  });

  it('does not claim Omarchy exclusivity or a required host', () => {
    const text = blob();
    expect(text.includes('Also Ubuntu, WSL, and macOS')).toBe(true);
    expect(text.includes('not required for Proof Sprint or Launch')).toBe(true);
    expect(text.toLowerCase().includes('only runs on omarchy')).toBe(false);
    expect(text.toLowerCase().includes('omarchy required')).toBe(false);
  });
});
