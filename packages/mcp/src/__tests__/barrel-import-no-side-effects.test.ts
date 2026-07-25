/**
 * GAP-406 regression: barrel re-exports of launch*Mcp must not start MCP
 * servers or call process.exit. apps/server loads MCPHypervisor from
 * `@revealui/mcp`; those re-exports previously executed each launcher's main().
 */
import { describe, expect, it, vi } from 'vitest';

const LAUNCHERS = [
  '../servers/neon.js',
  '../servers/stripe.js',
  '../servers/vercel.js',
  '../servers/playwright.js',
  '../servers/next-devtools.js',
] as const;

describe('MCP launcher modules (barrel-safe)', () => {
  it('import without process.exit / auto-main', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit unexpectedly called with ${code}`);
    }) as never);

    try {
      for (const path of LAUNCHERS) {
        await import(path);
      }
      // Let any microtask-scheduled main() settle
      await new Promise((r) => setTimeout(r, 50));
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});

describe('isDirectEntry', () => {
  it('is false when import.meta.url is not process.argv[1]', async () => {
    const { isDirectEntry } = await import('../servers/_launcher-utils.js');
    expect(isDirectEntry('file:///not/the/entry.js')).toBe(false);
  });
});
