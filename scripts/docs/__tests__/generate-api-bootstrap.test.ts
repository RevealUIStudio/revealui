import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as Array<{ command: string; args: string[] }>,
  events: [] as string[],
  exitCode: 0,
  spawnError: false,
  spec: {
    openapi: '3.0.3',
    info: { title: 'Fixture API', version: '0.0.0' },
    paths: {},
    tags: [],
    components: { schemas: {} },
  },
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, availableParallelism: () => 4 };
});
vi.mock('node:child_process', () => ({
  spawn: (command: string, args: string[]) => {
    state.calls.push({ command, args });
    state.events.push('build');
    const child = new EventEmitter();
    queueMicrotask(() => {
      if (state.spawnError) child.emit('error', new Error('synthetic spawn failure'));
      else {
        state.events.push('build-finished');
        child.emit('close', state.exitCode, null);
      }
    });
    return child;
  },
}));

let output: string;
beforeEach(() => {
  vi.resetModules();
  state.calls = [];
  state.events = [];
  state.exitCode = 0;
  state.spawnError = false;
  vi.doMock('../../../apps/server/src/app.js', () => {
    state.events.push('route-import');
    return {
      default: {
        getOpenAPIDocument: () => {
          state.events.push('generate');
          return state.spec;
        },
      },
      openApiConfiguration: {},
    };
  });
  output = join(mkdtempSync(join(tmpdir(), 'revealui-api-bootstrap-')), 'nested', 'README.md');
  vi.stubEnv('DOCS_API_OUT', output);
  vi.spyOn(process, 'availableMemory').mockReturnValue(4 * 1024 ** 3);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('API documentation supported bootstrap', () => {
  it.each([
    { memoryGiB: 1.5, cap: 1 },
    { memoryGiB: 4, cap: 2 },
  ])(
    'builds the declared graph with cap $cap before route import and both outputs',
    async ({ memoryGiB, cap }) => {
      vi.spyOn(process, 'availableMemory').mockReturnValue(memoryGiB * 1024 ** 3);
      const { generateApiDocs } = await import('../generate-api.js');
      await generateApiDocs();
      expect(state.calls).toEqual([
        {
          command: 'pnpm',
          args: ['turbo', 'run', 'build', '--filter=server^...', `--concurrency=${cap}`],
        },
      ]);
      expect(state.events).toEqual(['build', 'build-finished', 'route-import', 'generate']);
      expect(readFileSync(output, 'utf8')).toContain('0.0.0');
      expect(JSON.parse(readFileSync(join(output, '..', 'openapi.json'), 'utf8'))).toEqual(
        state.spec,
      );
    },
  );

  it.each(['failure', 'spawn-error'])(
    'does not import routes or produce artifacts on prerequisite %s',
    async (kind) => {
      state.exitCode = 7;
      state.spawnError = kind === 'spawn-error';
      const { generateApiDocs } = await import('../generate-api.js');
      await expect(generateApiDocs()).rejects.toThrow(
        kind === 'spawn-error' ? 'synthetic spawn failure' : 'API dependency graph failed',
      );
      expect(state.events).not.toContain('route-import');
      expect(state.events).not.toContain('generate');
      expect(existsSync(output)).toBe(false);
      expect(existsSync(join(output, '..', 'openapi.json'))).toBe(false);
    },
  );

  it('rejects insufficient available memory before starting the graph', async () => {
    vi.spyOn(process, 'availableMemory').mockReturnValue(1024 ** 3);
    const { generateApiDocs } = await import('../generate-api.js');
    await expect(generateApiDocs()).rejects.toThrow('admission rejected');
    expect(state.calls).toEqual([]);
    expect(state.events).toEqual([]);
  });
});
