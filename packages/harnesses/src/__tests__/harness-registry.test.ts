import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HarnessRegistry } from '../registry/harness-registry.js';
import type { HarnessAdapter } from '../types/adapter.js';
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessInfo,
} from '../types/core.js';

function makeAdapter(id: string, available = true): HarnessAdapter {
  return {
    id,
    name: `Test ${id}`,
    getCapabilities: vi.fn(
      (): HarnessCapabilities => ({
        generateCode: false,
        analyzeCode: false,
        applyEdit: false,
        applyConfig: false,
        readWorkboard: false,
        writeWorkboard: false,
      }),
    ),
    getInfo: vi.fn(
      async (): Promise<HarnessInfo> => ({
        id,
        name: `Test ${id}`,
        capabilities: {
          generateCode: false,
          analyzeCode: false,
          applyEdit: false,
          applyConfig: false,
          readWorkboard: false,
          writeWorkboard: false,
        },
      }),
    ),
    isAvailable: vi.fn(async () => available),
    execute: vi.fn(
      async (cmd: HarnessCommand): Promise<HarnessCommandResult> => ({
        success: true,
        command: cmd.type,
      }),
    ),
    onEvent: vi.fn(() => () => {}),
    dispose: vi.fn(async () => {}),
  };
}

describe('HarnessRegistry', () => {
  let registry: HarnessRegistry;

  beforeEach(() => {
    registry = new HarnessRegistry();
  });

  afterEach(async () => {
    await registry.disposeAll();
  });

  it('registers an adapter', () => {
    const adapter = makeAdapter('test-1');
    registry.register(adapter);
    expect(registry.get('test-1')).toBe(adapter);
  });

  it('throws on duplicate registration', () => {
    const adapter = makeAdapter('test-1');
    registry.register(adapter);
    expect(() => registry.register(makeAdapter('test-1'))).toThrow('already registered');
  });

  it('unregisters and disposes an adapter', async () => {
    const adapter = makeAdapter('test-1');
    registry.register(adapter);
    await registry.unregister('test-1');
    expect(registry.get('test-1')).toBeUndefined();
    expect(adapter.dispose).toHaveBeenCalled();
  });

  it('lists all registered adapters', () => {
    registry.register(makeAdapter('a'));
    registry.register(makeAdapter('b'));
    expect(registry.listAll()).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('listAvailable filters by isAvailable()', async () => {
    registry.register(makeAdapter('available', true));
    registry.register(makeAdapter('unavailable', false));
    const available = await registry.listAvailable();
    expect(available).toContain('available');
    expect(available).not.toContain('unavailable');
  });

  it('disposeAll clears all adapters', async () => {
    const a = makeAdapter('a');
    const b = makeAdapter('b');
    registry.register(a);
    registry.register(b);
    await registry.disposeAll();
    expect(registry.listAll()).toHaveLength(0);
    expect(a.dispose).toHaveBeenCalled();
    expect(b.dispose).toHaveBeenCalled();
  });

  it('returns undefined for unknown adapter', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });
});
