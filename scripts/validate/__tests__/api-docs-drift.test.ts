import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  execute: vi.fn(),
  read: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('node:child_process', () => ({ execFileSync: state.execute }));
vi.mock('node:fs', () => ({
  mkdtempSync: () => '/tmp/synthetic-api-docs-drift',
  readFileSync: state.read,
  rmSync: state.remove,
}));

describe('API documentation dependency bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    state.execute.mockReset();
    state.read.mockReset().mockReturnValue('synthetic committed reference');
    state.remove.mockReset();
  });

  it('delegates to the supported producer and accepts an identical generated reference', async () => {
    await import('../api-docs-drift.js');
    expect(state.execute).toHaveBeenCalledWith(
      'pnpm',
      ['docs:generate:api'],
      expect.objectContaining({
        env: expect.objectContaining({
          DOCS_API_OUT: '/tmp/synthetic-api-docs-drift/README.md',
        }),
      }),
    );
    expect(state.read).toHaveBeenCalledTimes(4);
  });

  it('fails when the JSON schema snapshot drifts even if the markdown matches', async () => {
    state.read
      .mockReturnValueOnce('same markdown')
      .mockReturnValueOnce('{"paths":{}}')
      .mockReturnValueOnce('same markdown')
      .mockReturnValueOnce('{"paths":{"/new":{}}}');
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('drift gate exited');
    }) as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(import('../api-docs-drift.js')).rejects.toThrow('drift gate exited');
    expect(exit).toHaveBeenCalledWith(1);
    expect(state.remove).toHaveBeenCalledWith('/tmp/synthetic-api-docs-drift', {
      recursive: true,
      force: true,
    });
  });

  it('fails closed when the supported dependency build fails and never consumes a generated reference', async () => {
    state.execute.mockImplementation(() => {
      throw new Error('synthetic dependency build failed');
    });
    await expect(import('../api-docs-drift.js')).rejects.toThrow(
      'synthetic dependency build failed',
    );
    expect(state.read).toHaveBeenCalledTimes(2);
    expect(state.remove).toHaveBeenCalledWith('/tmp/synthetic-api-docs-drift', {
      recursive: true,
      force: true,
    });
  });
});
