/**
 * Honesty gate for the REV Guardrail agent-template blurb.
 * Pins Brand SSOT copy and forbids SKU / SOC 2 / sister-product sales language.
 */
import { describe, expect, it } from 'vitest';
import { REV_GUARDRAIL } from '../rev-guardrail';

const FORBIDDEN = [
  'RevDev',
  'RevForge',
  'RevKit',
  'RevFleet',
  '$3500',
  '$3,500',
  '$3.500',
] as const;

function blob(): string {
  return JSON.stringify(REV_GUARDRAIL);
}

describe('REV Guardrail template/plugin blurb', () => {
  it('pins Brand SSOT title, eyebrow, and blurbs', () => {
    expect(REV_GUARDRAIL.title).toBe('REV Guardrail');
    expect(REV_GUARDRAIL.eyebrow).toBe('Agent template · Fleet plugin');
    expect(REV_GUARDRAIL.shortBlurb).toBe(
      'Keeps sibling agents in lane. Enforces your offer and price locks, blocks overclaim (including fake SOC 2), requires Snapshot before Checkpoint, and writes a receipt for every enforcement.',
    );
    expect(REV_GUARDRAIL.longer).toBe(
      'REV Guardrail is an enforcer agent for multi-agent fleets on RevealUI. You define locks (who owns which ship, cash ladder, ICP antis, honesty rules). Guardrail stops drift and leaves an audit trail. You run it on your runtime. It is a template, not a hosted chatbot.',
    );
  });

  it('includes the Brand checklist and does-not-include bounds', () => {
    expect(REV_GUARDRAIL.includes).toEqual([
      'lane/one-owner checks',
      'offer/price locks',
      'anti-overclaim (block SOC 2 certified without report)',
      'Snapshot-before-Checkpoint',
      'receipt per enforcement',
    ]);
    expect(REV_GUARDRAIL.doesNotInclude).toEqual([
      'autonomous capital decisions',
      'replacing founder judgment',
      'a separate public price SKU',
    ]);
  });

  it('is labeled as a template/plugin, not a live paid SKU', () => {
    expect(REV_GUARDRAIL.kind).toBe('template-plugin');
    expect(REV_GUARDRAIL.sku).toBeNull();
    expect(Object.hasOwn(REV_GUARDRAIL, 'price')).toBe(false);
    expect(REV_GUARDRAIL.eyebrow.toLowerCase().includes('template')).toBe(true);
    expect(REV_GUARDRAIL.longer.includes('It is a template')).toBe(true);
    expect(REV_GUARDRAIL.doesNotInclude.includes('a separate public price SKU')).toBe(true);
  });

  it('points at the runtime skeleton path, not a checkout SKU', () => {
    expect(REV_GUARDRAIL.sourcePath).toBe('templates/rev-guardrail');
    expect(REV_GUARDRAIL.sourceLabel).toBe('Source: templates/rev-guardrail/');
    expect(Object.hasOwn(REV_GUARDRAIL, 'docsHref')).toBe(false);
    expect(Object.hasOwn(REV_GUARDRAIL, 'checkoutHref')).toBe(false);
    expect(REV_GUARDRAIL.sourcePath.startsWith('http')).toBe(false);
    expect(REV_GUARDRAIL.sourceLabel.includes('$')).toBe(false);
  });

  it('does not sell RevDev, RevForge, RevKit, Fleet, or a $3500 SKU', () => {
    const text = blob();
    for (const phrase of FORBIDDEN) {
      expect(text.includes(phrase), `rev-guardrail copy must not include ${phrase}`).toBe(false);
    }
    expect(text.includes('Fleet $')).toBe(false);
    expect(Object.hasOwn(REV_GUARDRAIL, 'checkoutHref')).toBe(false);
  });

  it('does not use an em dash (marketing-voice house style)', () => {
    expect(blob().includes('\u2014')).toBe(false);
  });

  it('does not claim SOC 2 certified', () => {
    const text = blob();
    expect(text.includes('SOC 2 certified without report')).toBe(true);
    expect(text.includes('fake SOC 2')).toBe(true);
    expect(text.includes('SOC 2 certified.')).toBe(false);
    expect(text.includes('SOC2 certified')).toBe(false);
    expect(text.toLowerCase().includes('we are soc 2')).toBe(false);
    expect(text.toLowerCase().includes('soc 2 this quarter')).toBe(false);
  });
});
