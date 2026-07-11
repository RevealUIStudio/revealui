/**
 * Drift gate: asserts that the agency engagement ladder
 * (`AGENCY_ENGAGEMENT_LADDER` in `app/content/for-operators.ts`) is the
 * single source of truth for the four published engagement anchors —
 * Architecture Review, Launch Package, Fleet deployment, Custom Build —
 * and that every marketing surface that displays them derives from it
 * instead of authoring the literals inline.
 *
 * Failure mode the gate forbids: a future edit that re-introduces a
 * hand-typed "$25,000" or "$50,000" in any marketing content/* module
 * (the historical 2026-06-07 offerings-pin drift class).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOUNDER_SERVICE_OFFERINGS } from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';
import {
  AGENCY_ENGAGEMENT_LADDER,
  agencyEngagementPriceDisplay,
  FOR_OPERATORS_FAQ,
  FOR_OPERATORS_PRICING,
} from '../content/for-operators';
import { PRICING_DONE_FOR_YOU } from '../content/pricing';

const CONTENT_DIR = join(import.meta.dirname, '..', 'content');
const FOR_OPERATORS_SRC = readFileSync(join(CONTENT_DIR, 'for-operators.ts'), 'utf8');
const PRICING_SRC = readFileSync(join(CONTENT_DIR, 'pricing.ts'), 'utf8');

// Counts literal occurrences of `needle` in code, skipping comment lines.
// Module-scoped so multiple describes can pin single-ownership invariants.
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

describe('AGENCY_ENGAGEMENT_LADDER — canonical anchors', () => {
  it('pins the four published anchors, Launch Package between Architecture Review and Fleet deployment', () => {
    expect(AGENCY_ENGAGEMENT_LADDER.map((e) => [e.id, e.name, e.price, e.startsFrom])).toEqual([
      ['architecture-review', 'Architecture Review', '$3,500', false],
      ['launch-package', 'Launch Package', '$7,500', false],
      ['fleet-deployment', 'Fleet deployment', '$25,000', true],
      ['custom-build', 'Custom Build', '$50,000', true],
    ]);
  });

  it('renders Architecture Review and Launch Package as flat prices, and the rest with a "from" prefix', () => {
    const display = Object.fromEntries(
      AGENCY_ENGAGEMENT_LADDER.map((e) => [e.id, agencyEngagementPriceDisplay(e)]),
    );
    expect(display['architecture-review']).toBe('$3,500');
    expect(display['launch-package']).toBe('$7,500');
    expect(display['fleet-deployment']).toBe('from $25,000');
    expect(display['custom-build']).toBe('from $50,000');
  });
});

describe('marketing surfaces derive from the ladder', () => {
  it('FOR_OPERATORS_PRICING rungs reuse ladder name + display price', () => {
    expect(FOR_OPERATORS_PRICING.rungs.map((r) => [r.title, r.price])).toEqual(
      AGENCY_ENGAGEMENT_LADDER.map((e) => [e.name, agencyEngagementPriceDisplay(e)]),
    );
  });

  it('PRICING_DONE_FOR_YOU rungs reuse ladder name + display price', () => {
    expect(PRICING_DONE_FOR_YOU.rungs.map((r) => [r.name, r.price])).toEqual(
      AGENCY_ENGAGEMENT_LADDER.map((e) => [e.name, agencyEngagementPriceDisplay(e)]),
    );
  });

  it('FAQ "How much does it cost?" answer interpolates ladder anchors', () => {
    const faq = FOR_OPERATORS_FAQ.items.find(
      (item) => item.question === 'How much does it cost?',
    )?.answer;
    expect(faq, 'FAQ entry missing').toBeDefined();
    for (const engagement of AGENCY_ENGAGEMENT_LADDER) {
      expect(faq, `FAQ must mention ${engagement.name}`).toContain(engagement.name);
      expect(faq, `FAQ must reference ${engagement.price}`).toContain(engagement.price);
    }
  });
});

describe('single ownership of agency-only price anchors', () => {
  // The marketing /content tree must contain each bare anchor exactly once,
  // only inside AGENCY_ENGAGEMENT_LADDER. Other consumers either reuse the
  // exported objects or interpolate via priceDisplay() / template literals
  // that reference `engagement.price`. A future re-authoring of "$25,000"
  // anywhere else in code trips this gate.
  //
  // Comments are stripped before counting — illustrative anchors in
  // documentation prose (//, /* */, JSDoc) are not rendered surfaces and
  // must not gate the test.
  const agencyOnly = ['$25,000', '$50,000'] as const;

  for (const anchor of agencyOnly) {
    it(`${anchor} appears exactly once in content/for-operators.ts code (the ladder)`, () => {
      expect(countOccurrencesInCode(FOR_OPERATORS_SRC, anchor)).toBe(1);
    });

    it(`${anchor} does not appear in content/pricing.ts code (band derives via import)`, () => {
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

  it('agrees with the ladder on the shared Architecture Review price', () => {
    const review = FOUNDER_SERVICE_OFFERINGS.find((s) => s.id === 'architecture-review');
    const ladderReview = AGENCY_ENGAGEMENT_LADDER.find((e) => e.id === 'architecture-review');
    expect(review?.price).toBe(ladderReview?.price);
  });

  // Launch Package is the second rung shared between the founder-led menu
  // and the agency ladder (same pattern as Architecture Review above): both
  // surfaces import LAUNCH_PACKAGE_PRICE from @revealui/contracts/pricing
  // rather than re-authoring "$7,500", so this checks the two stay equal
  // instead of asserting the literal never appears anywhere else.
  it('agrees with the ladder on the shared Launch Package price', () => {
    const launch = FOUNDER_SERVICE_OFFERINGS.find((s) => s.id === 'launch-package');
    const ladderLaunch = AGENCY_ENGAGEMENT_LADDER.find((e) => e.id === 'launch-package');
    expect(launch?.price).toBe('$7,500');
    expect(launch?.price).toBe(ladderLaunch?.price);
  });

  it('$7,500 does not appear as a hand-typed literal in content/for-operators.ts code (imports LAUNCH_PACKAGE_PRICE instead)', () => {
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, '$7,500')).toBe(0);
  });

  it('$7,500 does not appear as a hand-typed literal in content/pricing.ts code (band derives via import)', () => {
    expect(countOccurrencesInCode(PRICING_SRC, '$7,500')).toBe(0);
  });
});
