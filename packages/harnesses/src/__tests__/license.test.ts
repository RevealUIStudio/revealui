import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stub heavy sub-modules that index.ts re-exports so the entire adapter /
// content / detection / server / coordinator tree is never loaded.
// ---------------------------------------------------------------------------

function mockHeavySubmodules(): void {
  vi.doMock('../config/config-sync.js', () => ({
    diffAllConfigs: vi.fn(),
    diffConfig: vi.fn(),
    syncAllConfigs: vi.fn(),
    syncConfig: vi.fn(),
    validateConfigJson: vi.fn(),
  }));
  vi.doMock('../config/harness-config-paths.js', () => ({
    getConfigurableHarnesses: vi.fn(),
    getLocalConfigPath: vi.fn(),
    getRootConfigPath: vi.fn(),
  }));
  vi.doMock('../content/index.js', () => ({
    buildManifest: vi.fn(),
    diffContent: vi.fn(),
    generateContent: vi.fn(),
    listContent: vi.fn(),
    validateManifest: vi.fn(),
  }));
  vi.doMock('../coordinator.js', () => ({ HarnessCoordinator: vi.fn() }));
  vi.doMock('../detection/auto-detector.js', () => ({ autoDetectHarnesses: vi.fn() }));
  vi.doMock('../detection/process-detector.js', () => ({
    findAllHarnessProcesses: vi.fn(),
    findClaudeCodeSockets: vi.fn(),
    findHarnessProcesses: vi.fn(),
    findProcesses: vi.fn(),
  }));
  vi.doMock('../registry/harness-registry.js', () => ({ HarnessRegistry: vi.fn() }));
  vi.doMock('../server/rpc-server.js', () => ({ RpcServer: vi.fn() }));
  vi.doMock('../workboard/index.js', () => ({
    acquireLock: vi.fn(),
    atomicWriteSync: vi.fn(),
    deriveSessionId: vi.fn(),
    detectSessionType: vi.fn(),
    lockPathFor: vi.fn(),
    releaseLock: vi.fn(),
    WorkboardManager: vi.fn(),
    withLock: vi.fn(),
    withLockAsync: vi.fn(),
  }));
}

describe('checkHarnessesLicense', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false and logs a warning when harnesses feature is disabled', async () => {
    vi.doMock('@revealui/core/features', () => ({ isFeatureEnabled: () => false }));
    vi.doMock('@revealui/core/license', () => ({ initializeLicense: async () => {} }));
    const warnSpy = vi.fn();
    vi.doMock('@revealui/core/observability/logger', () => ({ logger: { warn: warnSpy } }));
    mockHeavySubmodules();

    const { checkHarnessesLicense } = await import('../index.js');
    const result = await checkHarnessesLicense();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Pro or Enterprise license');
  });

  it('returns true when harnesses feature is enabled', async () => {
    vi.doMock('@revealui/core/features', () => ({ isFeatureEnabled: () => true }));
    vi.doMock('@revealui/core/license', () => ({ initializeLicense: async () => {} }));
    vi.doMock('@revealui/core/observability/logger', () => ({
      logger: { warn: vi.fn(), info: vi.fn() },
    }));
    mockHeavySubmodules();

    const { checkHarnessesLicense } = await import('../index.js');
    const result = await checkHarnessesLicense();

    expect(result).toBe(true);
  });
});
