import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    // biome-ignore lint/suspicious/noExplicitAny: test helper
    (_cmd: any, _args: any, _opts: any, callback: any) => {
      callback(new Error('not found'));
      return {} as never;
    },
  ),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: () => true,
}));

vi.mock('@revealui/core/license', () => ({
  initializeLicense: async () => {},
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@electric-sql/pglite', () => ({
  PGlite: class MockPGlite {
    async exec() {}
    async query() {
      return { rows: [] };
    }
    async close() {}
  },
}));

import { HarnessCoordinator } from '../coordinator.js';
import { WorkboardManager } from '../workboard/workboard-manager.js';

describe('HarnessCoordinator', () => {
  let projectRoot: string;
  let workboardPath: string;
  let socketPath: string;

  beforeEach(() => {
    // Block RevealUI agent adapter from detecting local Ollama
    vi.stubEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:1');
    projectRoot = join(tmpdir(), `coord-test-${Date.now()}`);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    workboardPath = join(projectRoot, '.claude', 'workboard.md');
    writeFileSync(
      workboardPath,
      '# Workboard\n\n## Sessions\n\n| id  | env | started | task | files | updated |\n| --- | --- | ------- | ---- | ----- | ------- |\n\n## Plans\n\n## Recent\n\n## Context\n\n## Plan Reference\n',
    );
    socketPath = join(tmpdir(), `coord-test-${Date.now()}.sock`);
  });

  afterEach(async () => {
    try {
      unlinkSync(workboardPath);
    } catch {}
    try {
      unlinkSync(workboardPath.replace('.md', '.lock'));
    } catch {}
    try {
      unlinkSync(socketPath);
    } catch {}
  });

  it('start registers a session in the workboard', async () => {
    const coord = new HarnessCoordinator({
      projectRoot,
      socketPath,
      task: 'test task',
    });
    await coord.start();
    const state = coord.getWorkboard().read();
    expect(state.agents.length).toBeGreaterThanOrEqual(1);
    const session = state.agents[0];
    expect(session?.task).toBe('test task');
    await coord.stop();
  });

  it('stop removes session and adds recent entry', async () => {
    const coord = new HarnessCoordinator({
      projectRoot,
      socketPath,
      task: 'ending task',
    });
    await coord.start();
    await coord.stop();
    const state = new WorkboardManager(workboardPath).read();
    expect(state.agents).toHaveLength(0);
    expect(state.log.length).toBeGreaterThanOrEqual(1);
    expect(state.log[0]).toContain('ending task');
  });

  it('getRegistry returns the registry', async () => {
    const coord = new HarnessCoordinator({ projectRoot, socketPath });
    const registry = coord.getRegistry();
    expect(registry.listAll()).toEqual([]);
  });

  it('getWorkboard returns the workboard manager', () => {
    const coord = new HarnessCoordinator({ projectRoot, socketPath });
    const wb = coord.getWorkboard();
    expect(wb).toBeInstanceOf(WorkboardManager);
  });

  it('healthCheck returns healthy result when workboard is readable', async () => {
    const coord = new HarnessCoordinator({ projectRoot, socketPath, task: 'health test' });
    await coord.start();
    const result = await coord.healthCheck();
    expect(result.workboard.readable).toBe(true);
    expect(result.workboard.sessionCount).toBeGreaterThanOrEqual(1);
    expect(result.timestamp).toBeTruthy();
    expect(result.diagnostics).toBeInstanceOf(Array);
    await coord.stop();
  });

  it('healthCheck detects stale sessions', async () => {
    const staleTimestamp = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
    writeFileSync(
      workboardPath,
      `# Workboard\n\n## Sessions\n\n| id  | env | started | task | files | updated |\n| --- | --- | ------- | ---- | ----- | ------- |\n| stale-agent | test | ${staleTimestamp}Z | old task | — | ${staleTimestamp}Z |\n\n## Plans\n\n## Recent\n\n## Context\n\n## Plan Reference\n`,
    );
    const coord = new HarnessCoordinator({ projectRoot, socketPath });
    await coord.start();
    const result = await coord.healthCheck();
    expect(result.workboard.staleSessionIds).toContain('stale-agent');
    expect(result.diagnostics.some((d) => d.includes('Stale sessions'))).toBe(true);
    await coord.stop();
  });

  it('healthCheck reports unavailable harnesses in diagnostics', async () => {
    const coord = new HarnessCoordinator({ projectRoot, socketPath });
    await coord.start();
    const result = await coord.healthCheck();
    for (const h of result.registeredHarnesses) {
      expect(h.available).toBe(false);
    }
    await coord.stop();
  });
});
