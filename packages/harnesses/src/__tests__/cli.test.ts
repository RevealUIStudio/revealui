/**
 * CLI smoke tests for revealui-harnesses
 *
 * Verifies that commands dispatch correctly without a license gate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock setup  -  stubs out heavy sub-modules that cli.ts imports
// so we don't load the entire content layer, adapters, or detection tree.
// ---------------------------------------------------------------------------

function mockCliDependencies(coordinator?: Record<string, unknown>): void {
  vi.doMock('../index.js', () => ({}));
  vi.doMock('../coordinator.js', () => ({
    HarnessCoordinator: coordinator
      ? class {
          start = coordinator.start ?? vi.fn().mockResolvedValue(undefined);
          stop = coordinator.stop ?? vi.fn().mockResolvedValue(undefined);
          getRegistry =
            coordinator.getRegistry ??
            vi.fn().mockReturnValue({ listAvailable: vi.fn().mockResolvedValue([]) });
          getWorkboard =
            coordinator.getWorkboard ??
            vi.fn().mockReturnValue({
              checkConflicts: vi.fn().mockReturnValue({ clean: true, conflicts: [] }),
            });
        }
      : vi.fn(),
  }));
  vi.doMock('../workboard/workboard-manager.js', () => ({ WorkboardManager: vi.fn() }));

  // Stub content layer  -  avoids loading definitions, generators, Zod schemas
  vi.doMock('../content/index.js', () => ({
    buildManifest: vi
      .fn()
      .mockReturnValue({ rules: [], commands: [], agents: [], skills: [], preambles: [] }),
    diffContent: vi.fn().mockReturnValue([]),
    generateContent: vi.fn().mockReturnValue([]),
    listContent: vi
      .fn()
      .mockReturnValue({ rules: 0, commands: 0, agents: 0, skills: 0, preambles: 0, total: 0 }),
    listGenerators: vi.fn().mockReturnValue([]),
    validateManifest: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('harnesses CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('start command invokes coordinator', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      if (code === 2) throw new Error(`process.exit(${code})`);
      return undefined as never;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.resetModules();
    process.argv = ['node', 'revealui-harnesses', 'start'];

    const mockStart = vi.fn().mockResolvedValue(undefined);
    mockCliDependencies({
      start: mockStart,
      getRegistry: vi
        .fn()
        .mockReturnValue({ listAvailable: vi.fn().mockResolvedValue(['claude']) }),
    });

    await expect(import('../cli.js')).resolves.toBeDefined();
    await new Promise((r) => setTimeout(r, 10));

    expect(exitSpy).not.toHaveBeenCalledWith(2);
    expect(mockStart).toHaveBeenCalled();
  });
});
