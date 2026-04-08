/**
 * Integration tests: two simulated agents coordinating via harnesses.
 *
 * Verifies that:
 * - Two HarnessCoordinators can register on the same workboard concurrently
 * - Session IDs are derived to avoid collisions
 * - File conflict detection works across agents
 * - Both coordinators stop cleanly, leaving no session rows
 * - Recent entries are written for both stopped sessions
 */

import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    (_cmd: unknown, _args: unknown, _opts: unknown, callback: (...args: unknown[]) => void) => {
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

const WORKBOARD_TEMPLATE =
  '# Workboard\n\n## Sessions\n\n| id  | env | started | task | files | updated |\n| --- | --- | ------- | ---- | ----- | ------- |\n\n## Plans\n\n## Recent\n\n## Context\n\n## Plan Reference\n';

describe('Multi-agent coordination integration', () => {
  let projectRoot: string;
  let workboardPath: string;
  let socket1: string;
  let socket2: string;

  beforeEach(() => {
    const ts = Date.now();
    projectRoot = join(tmpdir(), `harness-int-${ts}`);
    mkdirSync(join(projectRoot, '.claude'), { recursive: true });
    workboardPath = join(projectRoot, '.claude', 'workboard.md');
    writeFileSync(workboardPath, WORKBOARD_TEMPLATE);
    socket1 = join(tmpdir(), `harness-int-${ts}-1.sock`);
    socket2 = join(tmpdir(), `harness-int-${ts}-2.sock`);
  });

  afterEach(() => {
    for (const p of [workboardPath, workboardPath.replace('.md', '.lock'), socket1, socket2]) {
      try {
        unlinkSync(p);
      } catch {}
    }
  });

  it('both agents register in the workboard with unique session IDs', async () => {
    const coord1 = new HarnessCoordinator({
      projectRoot,
      socketPath: socket1,
      task: 'agent-1 task',
    });
    const coord2 = new HarnessCoordinator({
      projectRoot,
      socketPath: socket2,
      task: 'agent-2 task',
    });

    await coord1.start();
    await coord2.start();

    const state = new WorkboardManager(workboardPath).read();
    expect(state.agents.length).toBeGreaterThanOrEqual(2);

    const ids = state.agents.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // all IDs unique

    await coord1.stop();
    await coord2.stop();
  });

  it('file conflict detection finds overlaps between two active agents', async () => {
    const coord1 = new HarnessCoordinator({
      projectRoot,
      socketPath: socket1,
      task: 'editing auth',
    });
    const coord2 = new HarnessCoordinator({
      projectRoot,
      socketPath: socket2,
      task: 'editing routes',
    });

    await coord1.start();
    await coord2.start();

    // Agent 1 claims a file
    const wb = coord1.getWorkboard();
    const state = wb.read();
    const agent1Id = state.agents.find((s) => s.task === 'editing auth')?.id;
    expect(agent1Id).toBeTruthy();
    wb.claimFiles(agent1Id!, ['packages/auth/src/session.ts']);

    // Agent 2 checks for conflicts on the same file
    const agent2Id = state.agents.find((s) => s.task === 'editing routes')?.id;
    expect(agent2Id).toBeTruthy();
    const result = coord2
      .getWorkboard()
      .checkConflicts(agent2Id!, ['packages/auth/src/session.ts']);

    expect(result.clean).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.overlappingFiles).toContain('packages/auth/src/session.ts');

    await coord1.stop();
    await coord2.stop();
  });

  it('no conflict when agents claim different files', async () => {
    const coord1 = new HarnessCoordinator({ projectRoot, socketPath: socket1, task: 'agent-a' });
    const coord2 = new HarnessCoordinator({ projectRoot, socketPath: socket2, task: 'agent-b' });

    await coord1.start();
    await coord2.start();

    const wb = coord1.getWorkboard();
    const state = wb.read();
    const agent1Id = state.agents.find((s) => s.task === 'agent-a')?.id ?? '';
    const agent2Id = state.agents.find((s) => s.task === 'agent-b')?.id ?? '';

    wb.claimFiles(agent1Id, ['packages/auth/src/session.ts']);

    const result = coord2.getWorkboard().checkConflicts(agent2Id, ['packages/api/src/routes.ts']);
    expect(result.clean).toBe(true);
    expect(result.conflicts).toHaveLength(0);

    await coord1.stop();
    await coord2.stop();
  });

  it('workboard is empty and recent has two entries after both agents stop', async () => {
    const coord1 = new HarnessCoordinator({
      projectRoot,
      socketPath: socket1,
      task: 'first agent',
    });
    const coord2 = new HarnessCoordinator({
      projectRoot,
      socketPath: socket2,
      task: 'second agent',
    });

    await coord1.start();
    await coord2.start();
    await coord1.stop();
    await coord2.stop();

    const state = new WorkboardManager(workboardPath).read();
    expect(state.agents).toHaveLength(0);
    expect(state.log.length).toBeGreaterThanOrEqual(2);
    expect(state.log.some((l) => l.includes('first agent'))).toBe(true);
    expect(state.log.some((l) => l.includes('second agent'))).toBe(true);
  });

  it('health check from coord1 sees both active sessions in workboard', async () => {
    const coord1 = new HarnessCoordinator({ projectRoot, socketPath: socket1, task: 'health-a' });
    const coord2 = new HarnessCoordinator({ projectRoot, socketPath: socket2, task: 'health-b' });

    await coord1.start();
    await coord2.start();

    const result = await coord1.healthCheck();
    expect(result.workboard.readable).toBe(true);
    expect(result.workboard.sessionCount).toBeGreaterThanOrEqual(2);

    await coord1.stop();
    await coord2.stop();
  });
});
