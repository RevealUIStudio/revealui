import { describe, expect, it } from 'vitest';
import { CAPABILITIES, CAPABILITIES_SECTION } from '../capabilities';
import { HOME_ACTORS, HOME_FORK, HOME_OBJECTIONS } from '../home';
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
    it('exposes nine capabilities, matching the section copy', () => {
      expect(CAPABILITIES).toHaveLength(9);
      // The heading copy spells the count ("Nine ...") — keep them in lockstep.
      expect(CAPABILITIES_SECTION.body.toLowerCase()).toContain('nine');
    });

    it('every capability cites a real repo source file', () => {
      for (const cap of CAPABILITIES) {
        expect(cap.path.startsWith('packages/'), `${cap.title}: path not under packages/`).toBe(
          true,
        );
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

  describe('homepage fork', () => {
    it('exposes two self-identification branches, each fully populated', () => {
      const branches = [HOME_FORK.branchA, HOME_FORK.branchC];
      expect(branches).toHaveLength(2);
      for (const branch of branches) {
        expect(branch.title.length, 'empty title').toBeGreaterThan(0);
        expect(branch.body.length, 'empty body').toBeGreaterThan(0);
        expect(branch.cta.length, 'empty cta').toBeGreaterThan(0);
      }
    });

    it('the navigating branch carries an href', () => {
      expect(HOME_FORK.branchC.href.length).toBeGreaterThan(0);
    });
  });

  describe('three actors', () => {
    it('defines exactly three actors, each fully populated', () => {
      expect(HOME_ACTORS.actors).toHaveLength(3);
      for (const actor of HOME_ACTORS.actors) {
        expect(actor.role.length, 'empty role').toBeGreaterThan(0);
        expect(actor.action.length, 'empty action').toBeGreaterThan(0);
        expect(actor.body.length, 'empty body').toBeGreaterThan(0);
      }
    });

    it('names developer, operator, and agent', () => {
      const roles = HOME_ACTORS.actors.map((a) => a.role.toLowerCase());
      expect(roles.some((r) => r.includes('develop'))).toBe(true);
      expect(roles.some((r) => r.includes('operator'))).toBe(true);
      expect(roles.some((r) => r.includes('agent'))).toBe(true);
    });
  });

  describe('objections', () => {
    it('surfaces exactly two objection cards, each fully populated', () => {
      expect(HOME_OBJECTIONS.cards).toHaveLength(2);
      for (const card of HOME_OBJECTIONS.cards) {
        expect(card.heading.length, 'empty heading').toBeGreaterThan(0);
        expect(card.body.length, 'empty body').toBeGreaterThan(0);
      }
    });

    it('links onward to the full FAQ', () => {
      expect(HOME_OBJECTIONS.cta.href).toBe('#faq');
      expect(HOME_OBJECTIONS.cta.label.length).toBeGreaterThan(0);
    });
  });
});
