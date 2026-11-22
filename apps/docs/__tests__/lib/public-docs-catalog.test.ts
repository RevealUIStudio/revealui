/**
 * Public docs must not sell a studio menu beside the license catalog.
 * Paid product on these pages is revealui.com licenses. Pro $49/mo is the
 * self-serve path. Studio hour prices, rooms, and Cal.com stay off these pages.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function readDoc(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const LEFTOVER_STOREFRONT = [
  'Consultation',
  'Pilot',
  '$300',
  '$3,997',
  '$14,500',
  'services@revealui.com',
  'All perpetual tiers are available',
  'Architecture Review',
  'Migration Assist',
  'Consulting Hour',
  'architecture review',
  'launch packages',
  'fixed-bid',
  'Agency perpetual licensing',
  'cal.com',
  'Cal.com',
] as const;

const PUBLIC_SURFACES = [
  'docs/PRO.md',
  'docs/ROADMAP.md',
  'docs/ARCHITECTURE.md',
  'docs/WHAT_IS.md',
  'docs/WHAT_WORKS_TODAY.md',
  'docs/BUILD_YOUR_BUSINESS.md',
  'docs/blog/06-open-source-and-pro.md',
  'docs/blog/18-open-runtime-for-fde-work.md',
] as const;

describe('public docs catalog honesty', () => {
  it('does not sell a studio menu or leftover service SKUs on stranger-facing pages', () => {
    for (const file of PUBLIC_SURFACES) {
      const text = readDoc(file);
      for (const phrase of LEFTOVER_STOREFRONT) {
        expect(text.includes(phrase), `${file} must not sell "${phrase}"`).toBe(false);
      }
    }
  });

  it('points the Pro guide at revealui.com licenses and Pro self-serve', () => {
    const pro = readDoc('docs/PRO.md');
    expect(pro.includes('https://revealui.com/pricing')).toBe(true);
    expect(pro.includes('$49/mo')).toBe(true);
    expect(pro.includes('invoice')).toBe(true);
    expect(pro.includes('public perpetual')).toBe(true);
    expect(pro.includes('inquiry')).toBe(true);
  });
});
