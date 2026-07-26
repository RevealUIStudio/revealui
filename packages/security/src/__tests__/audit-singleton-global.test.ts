import { describe, expect, it, vi } from 'vitest';

/**
 * GAP-338 follow-up: the `audit` singleton must be PROCESS-wide, not
 * module-copy-wide.
 *
 * The admin production build bundles a separate copy of this package's module
 * graph into the instrumentation chunk and each route chunk (Turbopack;
 * `serverExternalPackages` does not take effect for the workspace package), so
 * a plain module-level singleton splits: the boot-time persistent-storage swap
 * lands on one copy while routes emit into their own in-memory copies —
 * observed live as `/api/health` `audit-storage: unhealthy` on hosted prod
 * (2026-07-25).
 *
 * `vi.resetModules()` + dynamic import simulates exactly that: two independent
 * module registries each evaluating `audit.ts` from scratch. Without the
 * `globalThis` anchor the two evaluations construct two different
 * `AuditSystem` instances and this test FAILS (proven red before the fix);
 * with the anchor both copies resolve the same instance, so a storage swap
 * installed through either copy is visible to the other.
 */
describe('audit singleton across duplicated module copies', () => {
  it('two independent module registries resolve the same AuditSystem instance', async () => {
    vi.resetModules();
    const firstCopy = await import('../audit');
    vi.resetModules();
    const secondCopy = await import('../audit');

    expect(firstCopy.audit).toBe(secondCopy.audit);
  });

  it('a storage swap through one copy is visible to the other copy', async () => {
    vi.resetModules();
    const firstCopy = await import('../audit');
    vi.resetModules();
    const secondCopy = await import('../audit');

    // A minimal non-in-memory storage stub: after swapping it in through the
    // FIRST copy, the SECOND copy must stop reporting in-memory storage — the
    // exact cross-bundle contract the admin /api/health `audit-storage` check
    // verifies in production (instrumentation swaps, route observes).
    const stub = {
      write: async () => undefined,
      query: async () => [],
      count: async () => 0,
    };
    firstCopy.audit.setStorage(stub);
    try {
      expect(firstCopy.audit.isInMemoryStorage()).toBe(false);
      expect(secondCopy.audit.isInMemoryStorage()).toBe(false);
    } finally {
      // Restore the default so the shared process-wide singleton does not leak
      // the stub into other suites in this worker.
      firstCopy.audit.setStorage(new firstCopy.InMemoryAuditStorage());
    }
  });
});
