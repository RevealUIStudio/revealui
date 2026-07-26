/**
 * GAP-436 (owner-ruled 2026-07-26) — admin's Forge boot license enforcement
 * block in instrumentation.ts `register()` mirrors apps/server's
 * `validateLicenseAtStartup` (see apps/server/src/lib/validate-startup.ts).
 * That block is not extracted into a separately-tested function (see the
 * TODO in instrumentation.ts), so this exercises `register()` directly with
 * the minimal mocking needed to reach the license gate without running the
 * unrelated production-only telemetry/engine-init branches.
 *
 * Proves:
 *  1. A plain self-host boot (forge-mode-detected, no license key) with
 *     REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true does NOT exit — Free (OSS)
 *     tier boot succeeds.
 *  2. REGRESSION GUARD: the same forge-mode/no-key boot WITHOUT the opt-in
 *     flag still calls process.exit(1) — RevForge-stamped kits are unaffected.
 *  3. The opt-in flag does not bypass verification of a key that IS present.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const detectDeploymentMode = vi.fn();
const validateLicenseKey = vi.fn();
const initializeLicense = vi.fn(async () => 'free' as const);
const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  addLogHandler: vi.fn(),
};

vi.mock('@revealui/core/deployment-mode', () => ({
  detectDeploymentMode: (...args: unknown[]) => detectDeploymentMode(...args),
}));

vi.mock('@revealui/core/license', () => ({
  validateLicenseKey: (...args: unknown[]) => validateLicenseKey(...args),
  initializeLicense: () => initializeLicense(),
}));

vi.mock('@revealui/core/observability/logger', () => ({ logger: loggerMock }));

vi.mock('@/lib/utils/env-validation', () => ({
  validateRequiredEnvVars: () => ({ valid: true, missing: [], warnings: [] }),
}));

vi.mock('@revealui/security', () => ({ configureClientIp: vi.fn() }));

describe('instrumentation.ts register() — Forge boot license enforcement (GAP-436)', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    initializeLicense.mockResolvedValue('free');
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__process-exit-called__');
    }) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_RUNTIME', '');
    vi.stubEnv('SKIP_ENV_VALIDATION', '');
    vi.stubEnv('REVEALUI_LICENSE_KEY', '');
    vi.stubEnv('REVEALUI_LICENSE_PUBLIC_KEY', '');
    vi.stubEnv('REVEALUI_ALLOW_UNLICENSED_SELF_HOST', '');
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('boots at Free (OSS) tier with no license key when the opt-in flag is set', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    vi.stubEnv('REVEALUI_ALLOW_UNLICENSED_SELF_HOST', 'true');

    const { register } = await import('../instrumentation');
    await expect(register()).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith('no license key — running Free (OSS) tier');
  });

  it('REGRESSION GUARD: still exits(1) in forge mode with no key when the flag is unset', async () => {
    detectDeploymentMode.mockReturnValue('forge');

    const { register } = await import('../instrumentation');
    await expect(register()).rejects.toThrow('__process-exit-called__');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('REVEALUI_LICENSE_KEY is required for RevForge'),
    );
  });

  it('the opt-in flag does not bypass verification of a key that IS present', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    vi.stubEnv('REVEALUI_ALLOW_UNLICENSED_SELF_HOST', 'true');
    vi.stubEnv('REVEALUI_LICENSE_KEY', 'some.jwt.value');
    vi.stubEnv('REVEALUI_LICENSE_PUBLIC_KEY', 'some-public-key');
    validateLicenseKey.mockResolvedValue(null); // invalid/expired/tampered

    const { register } = await import('../instrumentation');
    await expect(register()).rejects.toThrow('__process-exit-called__');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('REVEALUI_LICENSE_KEY is invalid'),
    );
  });

  it('is a no-op in hosted mode regardless of the flag', async () => {
    detectDeploymentMode.mockReturnValue('hosted');
    vi.stubEnv('REVEALUI_ALLOW_UNLICENSED_SELF_HOST', 'true');

    const { register } = await import('../instrumentation');
    await expect(register()).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalledWith('no license key — running Free (OSS) tier');
  });
});
