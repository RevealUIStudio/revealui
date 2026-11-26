/**
 * Product marketing must not publish the Studio price ladder. Prices stay in
 * @revealui/contracts for the agency path. Dead Fleet and Custom Build
 * objects must not exist.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOUNDER_SERVICE_OFFERINGS } from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';
import {
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

describe('product surfaces do not publish Studio prices', () => {
  it('does not export a done-for-you, starter-kit, founding-kit, or cost-calculator catalog', () => {
    expect(Object.hasOwn(pricing, 'PRICING_DONE_FOR_YOU')).toBe(false);
    expect(Object.hasOwn(pricing, 'PRICING_STARTER_KIT')).toBe(false);
    expect(Object.hasOwn(pricing, 'PRICING_AGENCY_FOUNDING_KIT')).toBe(false);
    expect(Object.hasOwn(pricing, 'PRICING_COST_CALCULATOR')).toBe(false);
  });

  it('points /services copy at revealuistudio.com without a price ladder', () => {
    expect(Object.hasOwn(FOR_OPERATORS_PRICING, 'rungs')).toBe(false);
    expect(FOR_OPERATORS_PRICING.body).toContain('revealuistudio.com');
    expect(FOR_OPERATORS_PRICING.primaryCta.href).toBe('https://revealuistudio.com');
    expect(FOR_OPERATORS_HERO.primaryCta.href).toBe('https://revealuistudio.com');
    expect(FOR_OPERATORS_CLOSING.primaryCta.href).toBe('https://revealuistudio.com');
  });

  it('FAQ "How much does it cost?" does not print Studio prices', () => {
    const faq = FOR_OPERATORS_FAQ.items.find(
      (item) => item.question === 'How much does it cost?',
    )?.answer;
    expect(faq).toContain('revealuistudio.com');
    expect(faq?.includes('$300')).toBe(false);
    expect(faq?.includes('$3,997')).toBe(false);
    expect(faq?.includes('$14,500')).toBe(false);
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

  it('keeps the studio proof line and points humans at revealuistudio.com', () => {
    expect(FOR_OPERATORS_PROOF.body.includes('5+ years')).toBe(true);
    expect(FOR_OPERATORS_HERO.primaryCta.label).toBe('Open revealuistudio.com');
    expect(FOR_OPERATORS_CLOSING.primaryCta.label).toBe('Open revealuistudio.com');
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

describe('FOUNDER_SERVICE_OFFERINGS — contract menu, not product-page copy', () => {
  it('does not include Fleet deployment or Custom Build', () => {
    const names = FOUNDER_SERVICE_OFFERINGS.map((s) => s.name);
    expect(names).not.toContain('Fleet deployment');
    expect(names).not.toContain('Custom Build');
  });

  it('keeps Pilot and Launch prices in contracts, off the product pricing block', () => {
    const proof = FOUNDER_SERVICE_OFFERINGS.find((s) => s.id === 'pilot');
    const launch = FOUNDER_SERVICE_OFFERINGS.find((s) => s.id === 'launch-package');
    expect(proof?.price).toBe('$3,997');
    expect(launch?.price).toBe('$14,500');
    const productCopy = JSON.stringify(FOR_OPERATORS_PRICING);
    expect(productCopy.includes('$3,997')).toBe(false);
    expect(productCopy.includes('$14,500')).toBe(false);
    expect(productCopy.includes('Proof Sprint')).toBe(false);
  });

  it('$14,500 does not appear as a hand-typed literal in content/for-operators.ts code', () => {
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, '$14,500')).toBe(0);
  });

  it('$14,500 does not appear as a hand-typed literal in content/pricing.ts code', () => {
    expect(countOccurrencesInCode(PRICING_SRC, '$14,500')).toBe(0);
  });

  it('$7,500 and the retired Pilot $1,500 price do not reappear in content/for-operators.ts', () => {
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, '$7,500')).toBe(0);
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, '$1,500')).toBe(0);
    expect(countOccurrencesInCode(FOR_OPERATORS_SRC, 'Pilot $1,500')).toBe(0);
  });
});

const RETIRED_PUBLIC_NAMES = [
  'Proof Sprint',
  'proof sprint',
  'Proof sprint',
  'PROOF SPRINT',
] as const;

const RETIRED_IDENTIFIERS = [
  'PROOF_SPRINT',
  'proofSprint',
  'proof-sprint',
  'proof_sprint',
] as const;

function listMarketingSources(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listMarketingSources(full, acc);
      continue;
    }
    if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.test.tsx') ||
      entry.name.endsWith('.test.js') ||
      entry.name.endsWith('.test.jsx')
    ) {
      continue;
    }
    if (
      entry.name.endsWith('.ts') ||
      entry.name.endsWith('.tsx') ||
      entry.name.endsWith('.js') ||
      entry.name.endsWith('.jsx')
    ) {
      acc.push(full);
    }
  }
}

describe('retired public name stays out of marketing copy', () => {
  it('has no user-visible Proof Sprint string in apps/marketing source', () => {
    const marketingRoot = join(import.meta.dirname, '../..');
    const files: string[] = [];
    listMarketingSources(marketingRoot, files);
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? '';
        const trimmed = line.trimStart();
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*/') ||
          trimmed.startsWith('*')
        ) {
          continue;
        }
        for (const phrase of RETIRED_PUBLIC_NAMES) {
          if (line.includes(phrase)) hits.push(`${file}:${index + 1}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('has no retired Proof Sprint identifiers in apps/marketing source', () => {
    const marketingRoot = join(import.meta.dirname, '../..');
    const files: string[] = [];
    listMarketingSources(marketingRoot, files);
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? '';
        for (const phrase of RETIRED_IDENTIFIERS) {
          if (line.includes(phrase)) hits.push(`${file}:${index + 1}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
