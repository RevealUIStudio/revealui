import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, resetConfig } from '../index';

// Mirror the loader mock used across config tests
vi.mock('../loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../loader.js')>();
  return {
    ...actual,
    loadEnvironment: vi.fn().mockImplementation(() => ({ ...process.env })),
  };
});

/**
 * Tests that the SKIP_ENV_VALIDATION guard correctly rejects misuse at runtime.
 * The guard is in isBuildTime()  -  it throws when SKIP_ENV_VALIDATION=true is used
 * outside a recognized Next.js build phase or test environment.
 */
describe('SKIP_ENV_VALIDATION guard', () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedNextPhase = process.env.NEXT_PHASE;

  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
    // Restore env to the state the setup.ts expects
    process.env.NODE_ENV = savedNodeEnv;
    if (savedNextPhase === undefined) {
      Reflect.deleteProperty(process.env, 'NEXT_PHASE');
    } else {
      process.env.NEXT_PHASE = savedNextPhase;
    }
  });

  it('throws when SKIP_ENV_VALIDATION=true in a non-test, non-build environment', () => {
    process.env.SKIP_ENV_VALIDATION = 'true';
    process.env.NODE_ENV = 'production';
    Reflect.deleteProperty(process.env, 'NEXT_PHASE');
    resetConfig();

    expect(() => getConfig()).toThrow('SKIP_ENV_VALIDATION=true is only valid during');
  });

  it('does NOT throw when SKIP_ENV_VALIDATION=true during phase-production-build', () => {
    process.env.SKIP_ENV_VALIDATION = 'true';
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PHASE = 'phase-production-build';
    resetConfig();

    // Should not throw the guard error (may throw for missing env vars  -  that's fine)
    let caughtMessage: string | undefined;
    try {
      getConfig();
    } catch (err) {
      caughtMessage = err instanceof Error ? err.message : String(err);
    }
    expect(caughtMessage).not.toContain('SKIP_ENV_VALIDATION=true is only valid during');
  });

  it('does NOT throw when SKIP_ENV_VALIDATION=true in NODE_ENV=test', () => {
    process.env.SKIP_ENV_VALIDATION = 'true';
    process.env.NODE_ENV = 'test';
    Reflect.deleteProperty(process.env, 'NEXT_PHASE');
    resetConfig();

    // Should not throw the guard error (may throw for missing env vars  -  that's fine)
    let caughtMessage: string | undefined;
    try {
      getConfig();
    } catch (err) {
      caughtMessage = err instanceof Error ? err.message : String(err);
    }
    // If no error was thrown, the guard passed  -  success
    if (caughtMessage !== undefined) {
      expect(caughtMessage).not.toContain('SKIP_ENV_VALIDATION=true is only valid during');
    }
  });
});
