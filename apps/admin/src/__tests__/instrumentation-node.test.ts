/**
 * GAP-214 regression guard for the deterministic boot-time engine init.
 *
 * Protects three properties of `initEngineAtBoot` (apps/admin/src/instrumentation-node.ts):
 *  1. On a Forge kit (RUNTIME_INIT set) it initializes the engine at boot, which
 *     is what runs config.onInit → the first-admin seeder. Without this a fresh
 *     kit boots healthy but can never be logged into.
 *  2. On hosted boot (RUNTIME_INIT unset) it does nothing — hosted seeds via
 *     account_entitlements and must not pay an eager engine init at every cold start.
 *  3. It never throws, honoring Next.js's instrumentation "never throw" contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getRevealUIInstance } = vi.hoisted(() => ({ getRevealUIInstance: vi.fn() }));

vi.mock('@/lib/utilities/revealui-singleton', () => ({ getRevealUIInstance }));

async function loadInitEngineAtBoot() {
  return (await import('../instrumentation-node')).initEngineAtBoot;
}

describe('initEngineAtBoot (GAP-214 boot-time first-admin seed)', () => {
  const originalRuntimeInit = process.env.RUNTIME_INIT;

  beforeEach(() => {
    // mockReset (not clearAllMocks) so a prior test's rejected impl can't bleed in.
    getRevealUIInstance.mockReset();
    getRevealUIInstance.mockResolvedValue({} as never);
  });

  afterEach(() => {
    if (originalRuntimeInit === undefined) {
      delete process.env.RUNTIME_INIT;
    } else {
      process.env.RUNTIME_INIT = originalRuntimeInit;
    }
  });

  it('initializes the engine at boot when RUNTIME_INIT is set (Forge kit)', async () => {
    process.env.RUNTIME_INIT = '1';
    const initEngineAtBoot = await loadInitEngineAtBoot();

    await initEngineAtBoot();

    expect(getRevealUIInstance).toHaveBeenCalledTimes(1);
  });

  it('does not initialize the engine when RUNTIME_INIT is unset (hosted boot unchanged)', async () => {
    delete process.env.RUNTIME_INIT;
    const initEngineAtBoot = await loadInitEngineAtBoot();

    await initEngineAtBoot();

    expect(getRevealUIInstance).not.toHaveBeenCalled();
  });

  it('never throws when engine init fails (instrumentation never-throw contract)', async () => {
    process.env.RUNTIME_INIT = '1';
    getRevealUIInstance.mockRejectedValue(new Error('db unreachable'));
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const initEngineAtBoot = await loadInitEngineAtBoot();

    await expect(initEngineAtBoot()).resolves.toBeUndefined();
    expect(stderr).toHaveBeenCalled();

    stderr.mockRestore();
  });
});
