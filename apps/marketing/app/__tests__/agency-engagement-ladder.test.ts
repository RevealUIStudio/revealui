/**
 * Drift gate for leftover studio anchors. The product /pricing catalog must
 * not derive a done-for-you ladder from AGENCY_ENGAGEMENT_LADDER. Studio
 * SKUs belong on revealuistudio.com: Consultation $300 / Proof Sprint $3,997 /
 * Launch $14,500. Dead Fleet and Custom Build objects must not exist.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOUNDER_SERVICE_OFFERINGS } from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';
import {
  AGENCY_ENGAGEMENT_LADDER,
  agencyEngagementPriceDisplay,
  FOR_OPERATORS_CLOSING,
  FOR_OPERATORS_FAQ,
  FOR_OPERATORS_HERO,
  FOR_OPERATORS_PRICING,
  FOR_OPERATORS_PROOF,
} from '../content/for-operators';
import * as pricing from '../content/pricing';

const CONTENT_DIR = join(import.meta.dirname, '..', 'content');
const FOR_OPERATORS_SRC = readFileSync(join(CONTENT_DIR, 'for-operators.ts'), 'utf8');
const PRICING_SRC = readFileSync(join(CONTENT_DIR, 'pricing.ts'), 'utf8');

function countOccurrencesInCode(source: string, needle: string): number {
  let count = 0;
  for (const line of source.split('\n')) {
    const trimmed = line.trimStart();
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*/') ||
      trimmed.startsWith('*')
    ) {
      continue;
    }
    let idx = line.indexOf(needle);
    while (idx !== -1) {
      count++;
      idx = line.indexOf(needle, idx + needle.length);
    }
  }
  return count;
}

describe('AGENCY_ENGAGEMENT_LADDER — locked studio anchors', () => {
  it('pins Consultation, Proof Sprint, and Launch only', () => {
    expect(AGENCY_ENGAGEMENT_LADDER.map((e) => [e.id, e.name, e.price, e.startsFrom])).toEqual([
      ['consultation', 'Consultation', '$300', false],
      ['proof-sprint', 'Proof Sprint', '$3,997', false],
      ['launch-package', 'Launch', '$14,500', false],
    ]);
  });

  it('does not include Fleet deployment or Custom Build', () => {
    const names = AGENCY_ENGAGEMENT_LADDER.map((e) => e.name);
    expect(names).not.toContain('Fleet deployment');
    expect(names).not.toContain('Custom Build');
  });

  it('renders studio rungs as flat prices', () => {
    const display = Object.fromEntries(
      AGENCY_ENGAGEMENT_LADDER.map((e) => [e.id, agencyEngagementPriceDisplay(e)]),
    );
    expect(display.consultation).toBe('$300');
    expect(display['proof-sprint']).toBe('$3,997');
    expect(display['launch-package']).toBe('$14,500');
  });
});

describe('product pricing.ts does not sell the studio ladder', () => {
  it('does not export a done-for-you, starter-kit, founding-kit, or cost-calculator catalog', () => {
    expect(Object.hasOwn(pricing, 'PRICING_DONE_FOR_YOU')).toBe(false);
    expect(Object.hasOwn(pricing, 'PRICING_STARTER_KIT')).toBe(false);
    expect(Object.hasOwn(pricing, 'PRICING_AGENCY_FOUNDING_KIT')).toBe(false);
    expect(Object.hasOwn(pricing, 'PRICING_COST_CALCULATOR')).toBe(false);
  });

  it('FOR_OPERATORS_PRICING rungs reuse ladder name + display price', () => {
    expect(FOR_OPERATORS_PRICING.rungs.map((r) => [r.title, r.price])).toEqual(
      AGENCY_ENGAGEMENT_LADDER.map((e) => [e.name, agencyEngagementPriceDisplay(e)]),
    );
  });

  it('FAQ "How much does it cost?" interpolates locked studio anchors', () => {
    const faq = FOR_OPERATORS_FAQ.items.find(
      (item) => item.question === 'How much does it cost?',
    )?.answer;
    expect(faq, 'FAQ entry missing').toBeDefined();
    for (const engagement of AGENCY_ENGAGEMENT_LADDER) {
      expect(faq, `FAQ must mention ${engagement.name}`).toContain(engagement.name);
      expect(faq, `FAQ must reference ${engagement.price}`).toContain(engagement.price);
    }
    expect(faq?.includes('Fleet deployment')).toBe(false);
    expect(faq?.includes('Custom Build')).toBe(false);
  });
});

describe('for-operators retired public copy stays gone', () => {
  it('does not republish Written plan, ten years, or Book a build call', () => {
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, 'Written plan')).toBe(0);
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, 'Ten years')).toBe(0);
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, 'Book a build call')).toBe(0);
  });

  it('uses Consultation, Proof Sprint, Launch, 5+ years, and a 30-minute intro', () => {
    expect(AGENCY_ENGAGEMENT_LADDER.map((e) => e.name)).toEqual([
      'Consultation',
      'Proof Sprint',
      'Launch',
    ]);
    expect(FOR_OPERATORS_PROOF.body.includes('5+ years')).toBe(true);
    expect(FOR_OPERATORS_HERO.primaryCta.label).toBe('Book a 30-minute intro');
    expect(FOR_OPERATORS_CLOSING.primaryCta.label).toBe('Book a 30-minute intro');
  });
});

describe('dead SKU anchors stay out of marketing content', () => {
  const deadAnchors = ['$25,000', '$50,000', 'Fleet deployment', 'Custom Build'] as const;

  for (const anchor of deadAnchors) {
    it(`${anchor} does not appear in content/for-operators.ts code`, () => {
      expect(countOccurrencesInCode(FOR_OPERATORS_SRC, anchor)).toBe(0);
    });

    it(`${anchor} does not appear in content/pricing.ts code`, () => {
      expect(countOccurrencesInCode(PRICING_SRC, anchor)).toBe(0);
    });
  }
});

describe('FOUNDER_SERVICE_OFFERINGS — founder-led services menu', () => {
  it('does not include Fleet deployment or Custom Build', () => {
    const names = FOUNDER_SERVICE_OFFERINGS.map((s) => s.name);
    expect(names).not.toContain('Fleet deployment');
    expect(names).not.toContain('Custom Build');
  });

  it('agrees with the studio ladder on the shared Proof Sprint price', () => {
    const proof = FOUNDER_SERVICE_OFFERINGS.find((s) => s.id === 'proof-sprint');
    const ladderProof = AGENCY_ENGAGEMENT_LADDER.find((e) => e.id === 'proof-sprint');
    expect(proof?.price).toBe('$3,997');
    expect(proof?.price).toBe(ladderProof?.price);
  });

  it('agrees with the studio ladder on the shared Launch price', () => {
    const launch = FOUNDER_SERVICE_OFFERINGS.find((s) => s.id === 'launch-package');
    const ladderLaunch = AGENCY_ENGAGEMENT_LADDER.find((e) => e.id === 'launch-package');
    expect(launch?.price).toBe('$14,500');
    expect(launch?.price).toBe(ladderLaunch?.price);
  });

  it('$14,500 does not appear as a hand-typed literal in content/for-operators.ts code', () => {
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, '$14,500')).toBe(0);
  });

  it('$14,500 does not appear as a hand-typed literal in content/pricing.ts code', () => {
    expect(countOccurrencesInCode(PRICING_SRC, '$14,500')).toBe(0);
  });

  it('$7,500 and Pilot do not reappear as hand-typed literals in content/for-operators.ts', () => {
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, '$7,500')).toBe(0);
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, 'Pilot')).toBe(0);
  });
});
