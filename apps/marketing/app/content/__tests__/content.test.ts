import { describe, expect, it } from 'vitest';
import { CAPABILITIES, CAPABILITIES_SECTION } from '../capabilities';
import { HOME_PRIMITIVES, PRODUCTS_PRIMITIVES } from '../primitives';
import { ROADMAP_SHIPPED, ROADMAP_UPCOMING } from '../roadmap';
import { METRICS, SITE } from '../site';

// Structural contracts for the marketing content modules. These guard the
// invariants TypeScript can't: counts, internal consistency, and the honesty
// rules the marketing-overhaul lane established. Metric VALUES are enforced
// separately against the codebase by scripts/validate/claim-drift.ts.

// Canonical primitive contract (Joshua's methodology corpus): People / Content /
// Offers / Payments / Agents. Body copy and footer reconcile to these.
const FIVE_PRIMITIVES = ['People', 'Content', 'Offers', 'Payments', 'Agents'];

describe('marketing content contracts', () => {
  describe('primitives', () => {
    it('home and products each expose exactly the five primitives', () => {
      expect(HOME_PRIMITIVES).toHaveLength(5);
      expect(PRODUCTS_PRIMITIVES).toHaveLength(5);
    });

    it('both primitive sets name the same five, in the same order', () => {
      expect(HOME_PRIMITIVES.map((p) => p.label)).toEqual(FIVE_PRIMITIVES);
      expect(PRODUCTS_PRIMITIVES.map((p) => p.name)).toEqual(FIVE_PRIMITIVES);
    });
  });

  describe('capabilities', () => {
    it('exposes eight capabilities, matching the section copy', () => {
      expect(CAPABILITIES).toHaveLength(8);
      // The heading copy spells the count ("Eight ..."); keep them in lockstep.
      expect(CAPABILITIES_SECTION.body.toLowerCase()).toContain('eight');
    });

    it('every capability cites a real repo source file', () => {
      for (const cap of CAPABILITIES) {
        expect(
          cap.path.startsWith('packages/') || cap.path.startsWith('apps/'),
          `${cap.title}: path not under packages/ or apps/`,
        ).toBe(true);
        expect(cap.href.startsWith(SITE.urls.repo), `${cap.title}: href not in the repo`).toBe(
          true,
        );
      }
    });
  });

  describe('roadmap', () => {
    it('the "recently shipped" section contains only shipped items', () => {
      for (const item of ROADMAP_SHIPPED) {
        expect(
          ['Shipped', 'Available'],
          `${item.name} is in the shipped section but marked "${item.status}"`,
        ).toContain(item.status);
      }
    });

    it('upcoming items are never labelled as shipped', () => {
      for (const item of ROADMAP_UPCOMING) {
        expect(['Shipped', 'Available']).not.toContain(item.status);
      }
    });

    it('every roadmap item is fully populated', () => {
      for (const item of [...ROADMAP_SHIPPED, ...ROADMAP_UPCOMING]) {
        expect(item.name.length, 'empty name').toBeGreaterThan(0);
        expect(item.description.length, `${item.name}: empty description`).toBeGreaterThan(0);
        expect(item.status.length, `${item.name}: empty status`).toBeGreaterThan(0);
        expect(item.category.length, `${item.name}: empty category`).toBeGreaterThan(0);
      }
    });
  });

  describe('metrics', () => {
    const COUNT_KEYS = [
      'packages',
      'apps',
      'workspaces',
      'testFiles',
      'uiComponents',
      'mcpServers',
      'dbTables',
    ] as const;

    it('every count is a positive integer', () => {
      for (const key of COUNT_KEYS) {
        expect(Number.isInteger(METRICS[key]), `METRICS.${key} not an integer`).toBe(true);
        expect(METRICS[key], `METRICS.${key} not positive`).toBeGreaterThan(0);
      }
    });

    it('workspaces equals packages plus apps', () => {
      expect(METRICS.workspaces).toBe(METRICS.packages + METRICS.apps);
    });

    it('the license split sums to the package count', () => {
      const { mit, fsl, internal } = METRICS.licenseSplit;
      expect(mit + fsl + internal).toBe(METRICS.packages);
    });
  });
});
