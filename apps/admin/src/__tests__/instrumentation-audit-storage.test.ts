/**
 * GAP-338 — the admin process must install persistent audit storage at boot.
 *
 * Before this fix the admin process NEVER called `audit.setStorage(...)`, so
 * every admin-side audit emit (including the GAP-334 login receipts wired via
 * the auth bridge) landed in the default `InMemoryAuditStorage` and evaporated
 * on restart. `installAdminAuditStorage` is the boot hook (called from
 * `instrumentation.ts` behind the `NEXT_RUNTIME === 'nodejs'` guard) that swaps
 * the process-wide AuditSystem onto the shared `DrizzleBackedAuditStorage`
 * (`@revealui/auth/server`, the same boundary apps/server installs).
 *
 * RED-FIRST: this file was written before `installAdminAuditStorage` existed —
 * on the pre-fix tree the import fails, proving the admin process had no
 * install path at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const assertAuditStorageEnv = vi.fn();
const installAuditStorage = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  assertAuditStorageEnv: (...args: unknown[]) => assertAuditStorageEnv(...args),
  installAuditStorage: (...args: unknown[]) => installAuditStorage(...args),
}));

describe('installAdminAuditStorage (GAP-338)', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // resetAllMocks (not clearAllMocks): per-test mockImplementation()s on the
    // shared assert/install fns must not leak into the next case.
    vi.resetAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__process-exit-called__');
    }) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('happy path: asserts env parity, then installs persistent storage', async () => {
    const { installAdminAuditStorage } = await import('../instrumentation-node');
    await installAdminAuditStorage();

    expect(assertAuditStorageEnv).toHaveBeenCalledTimes(1);
    expect(installAuditStorage).toHaveBeenCalledTimes(1);
    // Order matters: a diverged-env deploy must fail BEFORE a store is installed.
    expect(assertAuditStorageEnv.mock.invocationCallOrder[0]).toBeLessThan(
      installAuditStorage.mock.invocationCallOrder[0] as number,
    );
  });

  it('production + env parity failure: refuses to serve (process.exit(1)), never installs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SKIP_ENV_VALIDATION', '');
    assertAuditStorageEnv.mockImplementation(() => {
      throw new Error('AUDIT STORAGE ENV PARITY FAILED: test');
    });

    const { installAdminAuditStorage } = await import('../instrumentation-node');
    await installAdminAuditStorage();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(installAuditStorage).not.toHaveBeenCalled();
  });

  it('dev + env parity failure: warns and skips install, does NOT exit and does NOT throw', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    assertAuditStorageEnv.mockImplementation(() => {
      throw new Error('AUDIT STORAGE ENV PARITY FAILED: no db');
    });

    const { installAdminAuditStorage } = await import('../instrumentation-node');
    await expect(installAdminAuditStorage()).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(installAuditStorage).not.toHaveBeenCalled();
    const written = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    expect(written).toContain('GAP-338');
  });

  it('never throws out of instrumentation, even when install itself fails', async () => {
    installAuditStorage.mockImplementation(() => {
      throw new Error('unexpected install failure');
    });

    const { installAdminAuditStorage } = await import('../instrumentation-node');
    await expect(installAdminAuditStorage()).resolves.toBeUndefined();
    const written = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    expect(written).toContain('non-fatal');
  });
});
