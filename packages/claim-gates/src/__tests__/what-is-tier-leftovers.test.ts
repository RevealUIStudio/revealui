import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../');

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

/**
 * Leftover public-copy pins a stranger or marketer can still copy.
 * WHAT_IS.md after #2727 is the SoT: Free = Local AI, Enterprise = inquire.
 * No regex (M2): exact leftover phrases only.
 */
const PUBLIC_COPY_SURFACES = [
  'docs/WHAT_IS.md',
  'docs/PRO.md',
  'docs/FLEET.md',
  'docs/ENTERPRISE.md',
  'docs/MARKETING_METRICS.md',
  'docs/blog/06-open-source-and-pro.md',
  'docs/blog/05-five-primitives.md',
  'docs/architecture/ai-stack.md',
  'docs/ROADMAP.md',
  'README.md',
  'AGENTS.md',
  'apps/marketing/app/content/site.ts',
  'apps/marketing/app/content/for-operators-managed.ts',
  'apps/marketing/app/components/for-operators-managed/Waitlist.tsx',
] as const;

describe('WHAT_IS leftover public-copy pins (#528 claim-drift)', () => {
  it('keeps Free as Local AI in the canonical What-is table', () => {
    const whatIs = readRepo('docs/WHAT_IS.md');
    expect(whatIs.includes('| Free | $0 | 1 | 3 | Local AI | 200 |')).toBe(true);
    expect(whatIs.includes('| Free | $0 | 1 | 3 | 1,000 |')).toBe(false);
  });

  it('does not leave Free 1,000 agent-task quota on public What-is / tier surfaces', () => {
    for (const rel of PUBLIC_COPY_SURFACES) {
      const text = readRepo(rel);
      expect(text.includes('| **Agent tasks/mo** | 1,000 |'), rel).toBe(false);
      expect(text.includes('| Free | 1,000 tasks |'), rel).toBe(false);
      expect(text.includes('| Free | $0 | 1 | 3 | 1,000 |'), rel).toBe(false);
    }
  });

  it('does not leave Enterprise $1,499/mo or Agency $8,499 as a public catalog pin', () => {
    for (const rel of PUBLIC_COPY_SURFACES) {
      const text = readRepo(rel);
      expect(text.includes('$1,499/mo'), rel).toBe(false);
      expect(text.includes('$1,499/month'), rel).toBe(false);
      expect(text.includes('$8,499'), rel).toBe(false);
    }
  });

  it('does not leave Cloud waitlist, Starter Kit checkout, or Fleet-as-SKU catalog copy', () => {
    for (const rel of PUBLIC_COPY_SURFACES) {
      const text = readRepo(rel);
      expect(text.includes('Join the waitlist'), rel).toBe(false);
      expect(text.includes('RevealUI Cloud waitlist'), rel).toBe(false);
      expect(text.includes('Cloud (waitlist)'), rel).toBe(false);
      expect(text.includes('starterKitCheckout'), rel).toBe(false);
      expect(text.includes('buy.stripe.com/dRmeVegcH'), rel).toBe(false);
      expect(text.includes('deployment-level commercial product'), rel).toBe(false);
    }
  });

  it('does not pin Free to a public 1,000 agent-task quota in contracts', () => {
    const pricing = readRepo('packages/contracts/src/pricing.ts');
    expect(pricing.includes('free: { sites: 1, users: 3, agentTasks: 1_000')).toBe(false);
    expect(pricing.includes('free: { sites: 1, users: 3, agentTasks: 0')).toBe(true);
  });
});
