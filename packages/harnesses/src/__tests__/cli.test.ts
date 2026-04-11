/**
 * CLI license gate tests for revealui-harnesses (GAP-040)
 *
 * Verifies that:
 * - Without a Pro license → process exits with code 2 and prints error
 * - With a Pro license → command proceeds normally
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock setup  -  stubs out heavy sub-modules that cli.ts imports
// so we don't load the entire content layer, adapters, or detection tree.
// ---------------------------------------------------------------------------

/** Register doMock stubs for all heavy cli.ts dependencies. */
function mockCliDependencies(overrides: {
  licensed: boolean;
  coordinator?: Record<string, unknown>;
}): void {
  vi.doMock('../index.js', () => ({
    checkHarnessesLicense: vi.fn().mockResolvedValue(overrides.licensed),
  }));
  vi.doMock('../coordinator.js', () => ({
    HarnessCoordinator: overrides.coordinator
      ? class {
          start = overrides.coordinator!.start ?? vi.fn().mockResolvedValue(undefined);
          stop = overrides.coordinator!.stop ?? vi.fn().mockResolvedValue(undefined);
          getRegistry =
            overrides.coordinator!.getRegistry ??
            vi.fn().mockReturnValue({ listAvailable: vi.fn().mockResolvedValue([]) });
          getWorkboard =
            overrides.coordinator!.getWorkboard ??
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

describe('harnesses CLI  -  license gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('exits with code 2 and prints error when license check fails (licensed command)', async () => {
    // Only throw for code 2 to stop main(); let code 1 (catch handler) pass
    // through silently to avoid cascading unhandled rejections.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      if (code === 2) throw new Error(`process.exit(${code})`);
      return undefined as never;
    });
    const stderrOutput: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      stderrOutput.push(String(s));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    vi.resetModules();
    // Use 'status'  -  a command that requires a Pro license (unlike start/coordinate/health)
    process.argv = ['node', 'revealui-harnesses', 'status'];

    mockCliDependencies({ licensed: false });

    await expect(import('../cli.js')).resolves.toBeDefined();
    await new Promise((r) => setTimeout(r, 10));

    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stderrOutput.join('')).toContain('Pro license');
  });

  it('proceeds past the gate when license check passes (start command)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      if (code === 2) throw new Error(`process.exit(${code})`);
      return undefined as never;
    });
    const stdoutOutput: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      stdoutOutput.push(String(s));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.resetModules();
    process.argv = ['node', 'revealui-harnesses', 'start'];

    const mockStart = vi.fn().mockResolvedValue(undefined);
    mockCliDependencies({
      licensed: true,
      coordinator: {
        start: mockStart,
        getRegistry: vi
          .fn()
          .mockReturnValue({ listAvailable: vi.fn().mockResolvedValue(['claude']) }),
      },
    });

    await expect(import('../cli.js')).resolves.toBeDefined();
    await new Promise((r) => setTimeout(r, 10));

    // process.exit should NOT have been called with 2 (license failure)
    const exit2Calls = exitSpy.mock.calls.filter(([code]) => code === 2);
    expect(exit2Calls).toHaveLength(0);

    // Coordinator should have been started
    expect(mockStart).toHaveBeenCalled();
  });

  it('exits with code 2 for any command when unlicensed (status)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      if (code === 2) throw new Error(`process.exit(${code})`);
      return undefined as never;
    });
    const stderrOutput: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      stderrOutput.push(String(s));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    vi.resetModules();
    process.argv = ['node', 'revealui-harnesses', 'status'];

    mockCliDependencies({ licensed: false });

    await expect(import('../cli.js')).resolves.toBeDefined();
    await new Promise((r) => setTimeout(r, 10));

    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stderrOutput.join('')).toContain('Pro license');
  });
});
