import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkboardManager } from '../workboard/workboard-manager.js';

// v2 fixture with all sections
const V2_FIXTURE = `# Workboard

> Coordination file for all agents.

## Agents

| id | env | started | task | files | updated |
| --- | --- | --- | --- | --- | --- |
| agent-edit | Zed terminal | 2026-03-30T01:00Z | T-009 | packages/harnesses/** | 2026-03-30T01:30Z |
| agent-system | WSL bash | 2026-03-30T00:30Z | T-005 | apps/studio/** | 2026-03-30T01:00Z |

## Tasks

| id | task | pri | status | owner | gh | updated | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | External quick-start validation | P1 | available |  -  | #88 | 2026-03-30 | need cold-start devs |
| T-005 | Dependency version bumps | P2 | claimed | agent-system |  -  | 2026-03-30 | russh CVE |
| T-009 | Workboard v2 hooks + harnesses | P1 | claimed | agent-edit |  -  | 2026-03-30 | parser written |
| T-006 | admin clsx cleanup | P3 | partial |  -  |  -  | 2026-03-30 | 15 of 25 components done |

## Blocked

| id | task | blocker | gh | notes |
| --- | --- | --- | --- | --- |
| T-020 | Stripe live mode | UX verification needed |  -  | test to live keys |
| T-022 | Turbo remote cache | needs TURBO_TOKEN | #86 |  -  |

## Done

| id | task | owner | completed | gh | notes |
| --- | --- | --- | --- | --- | --- |
| T-100 | Branch simplification | agent-edit | 2026-03-30 |  -  | done |
| T-101 | Stripe credit bundles | agent-edit | 2026-03-30 |  -  | done |

## Log

- [2026-03-30 01:30] agent-edit: Workboard v2 implemented
- [2026-03-30 00:40] agent-edit: Session 136 started
`;

// v1 fixture (backward compat  -  old section names)
const V1_FIXTURE = `# Workboard

## Sessions

| id | env | started | task | files | updated |
| --- | --- | --- | --- | --- | --- |
| terminal-1 | WSL/bash | 2026-03-03T14:00Z | Phase 2.7 | apps/api/** | 2026-03-03T14:00Z |
| zed-1 | Zed/ACP | 2026-03-03T15:00Z | Phase 2.6 | packages/harnesses/** | 2026-03-03T15:00Z |

## Recent

- [2026-03-03 14:00] terminal-1: did something useful
- [2026-03-03 13:00] zed-1: earlier work
`;

describe('WorkboardManager', () => {
  let workboardPath: string;
  let manager: WorkboardManager;

  beforeEach(() => {
    workboardPath = join(
      tmpdir(),
      `workboard-test-${Date.now()}-${Math.random().toString(36).slice(2)}.md`,
    );
    writeFileSync(workboardPath, V2_FIXTURE, 'utf8');
    manager = new WorkboardManager(workboardPath);
  });

  afterEach(() => {
    try {
      unlinkSync(workboardPath);
    } catch {}
    try {
      unlinkSync(`${workboardPath}.lock`);
    } catch {}
  });

  it('rejects non-.md paths', () => {
    expect(() => new WorkboardManager('/tmp/workboard.txt')).toThrow('must be a .md file');
  });

  // ---- Parsing ----

  describe('parsing', () => {
    it('parses agents from the table', () => {
      const state = manager.read();
      expect(state.agents).toHaveLength(2);
      expect(state.agents[0].id).toBe('agent-edit');
      expect(state.agents[1].id).toBe('agent-system');
    });

    it('parses tasks with all columns', () => {
      const state = manager.read();
      expect(state.tasks).toHaveLength(4);
      expect(state.tasks[0].id).toBe('T-001');
      expect(state.tasks[0].status).toBe('available');
      expect(state.tasks[0].gh).toBe('#88');
      expect(state.tasks[2].status).toBe('claimed');
      expect(state.tasks[2].owner).toBe('agent-edit');
    });

    it('parses blocked tasks', () => {
      const state = manager.read();
      expect(state.blocked).toHaveLength(2);
      expect(state.blocked[0].id).toBe('T-020');
      expect(state.blocked[1].blocker).toBe('needs TURBO_TOKEN');
    });

    it('parses done tasks', () => {
      const state = manager.read();
      expect(state.done).toHaveLength(2);
      expect(state.done[0].id).toBe('T-100');
      expect(state.done[0].completed).toBe('2026-03-30');
    });

    it('parses log entries', () => {
      const state = manager.read();
      expect(state.log).toHaveLength(2);
      expect(state.log[0]).toContain('agent-edit');
    });

    it('preserves preamble lines', () => {
      const state = manager.read();
      expect(state.preamble[0]).toBe('# Workboard');
      expect(state.preamble.some((l) => l.includes('Coordination file'))).toBe(true);
    });

    it('normalizes em-dash to empty string', () => {
      const state = manager.read();
      const t001 = state.tasks.find((t) => t.id === 'T-001');
      expect(t001?.owner).toBe('');
    });

    it('returns empty state for missing file', () => {
      const missing = new WorkboardManager(join(tmpdir(), 'nonexistent.md'));
      const state = missing.read();
      expect(state.agents).toHaveLength(0);
      expect(state.tasks).toHaveLength(0);
    });
  });

  // ---- Backward compat (v1 section names) ----

  describe('backward compat (v1)', () => {
    beforeEach(() => {
      writeFileSync(workboardPath, V1_FIXTURE, 'utf8');
    });

    it('maps Sessions to agents', () => {
      const state = manager.read();
      expect(state.agents).toHaveLength(2);
      expect(state.agents[0].id).toBe('terminal-1');
    });

    it('maps Recent to log', () => {
      const state = manager.read();
      expect(state.log).toHaveLength(2);
      expect(state.log[0]).toContain('terminal-1');
    });
  });

  // ---- Agent methods ----

  describe('registerAgent', () => {
    it('adds a new agent row', () => {
      manager.registerAgent({
        id: 'agent-new',
        env: 'test',
        started: '2026-03-30T02:00Z',
        task: '(starting)',
        files: '',
        updated: '2026-03-30T02:00Z',
      });
      const state = manager.read();
      expect(state.agents.find((a) => a.id === 'agent-new')).toBeDefined();
      expect(state.agents).toHaveLength(3);
    });

    it('replaces an existing agent row', () => {
      manager.registerAgent({
        id: 'agent-edit',
        env: 'Zed terminal',
        started: '2026-03-30T01:00Z',
        task: 'updated task',
        files: '',
        updated: '2026-03-30T02:00Z',
      });
      const state = manager.read();
      const row = state.agents.find((a) => a.id === 'agent-edit');
      expect(row?.task).toBe('updated task');
      expect(state.agents).toHaveLength(2);
    });
  });

  describe('unregisterAgent', () => {
    it('removes the agent row', () => {
      manager.unregisterAgent('agent-system');
      const state = manager.read();
      expect(state.agents.find((a) => a.id === 'agent-system')).toBeUndefined();
      expect(state.agents).toHaveLength(1);
    });
  });

  describe('updateAgent', () => {
    it('updates specific fields', () => {
      manager.updateAgent('agent-edit', { task: 'new task', files: 'apps/admin/**' });
      const state = manager.read();
      const row = state.agents.find((a) => a.id === 'agent-edit');
      expect(row?.task).toBe('new task');
      expect(row?.files).toBe('apps/admin/**');
    });

    it('is a no-op for unknown agent', () => {
      manager.updateAgent('nonexistent', { task: 'oops' });
      const state = manager.read();
      expect(state.agents).toHaveLength(2);
    });
  });

  // ---- Task claiming ----

  describe('claimTask', () => {
    it('claims an available task', () => {
      const ok = manager.claimTask('T-001', 'agent-new');
      expect(ok).toBe(true);
      const state = manager.read();
      const task = state.tasks.find((t) => t.id === 'T-001');
      expect(task?.status).toBe('claimed');
      expect(task?.owner).toBe('agent-new');
    });

    it('claims a partial task', () => {
      const ok = manager.claimTask('T-006', 'agent-new');
      expect(ok).toBe(true);
      const state = manager.read();
      const task = state.tasks.find((t) => t.id === 'T-006');
      expect(task?.status).toBe('claimed');
      expect(task?.owner).toBe('agent-new');
    });

    it('refuses to claim an already-claimed task', () => {
      const ok = manager.claimTask('T-005', 'agent-edit');
      expect(ok).toBe(false);
      const state = manager.read();
      const task = state.tasks.find((t) => t.id === 'T-005');
      expect(task?.owner).toBe('agent-system');
    });

    it('returns false for nonexistent task', () => {
      expect(manager.claimTask('T-999', 'agent-edit')).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('moves task from Tasks to Done', () => {
      const ok = manager.completeTask('T-009', 'agent-edit');
      expect(ok).toBe(true);
      const state = manager.read();
      expect(state.tasks.find((t) => t.id === 'T-009')).toBeUndefined();
      expect(state.done[0].id).toBe('T-009');
      expect(state.done[0].owner).toBe('agent-edit');
    });

    it('returns false for nonexistent task', () => {
      expect(manager.completeTask('T-999', 'agent-edit')).toBe(false);
    });
  });

  describe('markPartial', () => {
    it('sets status to partial with notes', () => {
      const ok = manager.markPartial('T-009', 'stopped mid-work');
      expect(ok).toBe(true);
      const state = manager.read();
      const task = state.tasks.find((t) => t.id === 'T-009');
      expect(task?.status).toBe('partial');
      expect(task?.notes).toBe('stopped mid-work');
    });

    it('returns false for nonexistent task', () => {
      expect(manager.markPartial('T-999', 'nope')).toBe(false);
    });
  });

  describe('releaseTask', () => {
    it('releases a claimed task back to available', () => {
      const ok = manager.releaseTask('T-005');
      expect(ok).toBe(true);
      const state = manager.read();
      const task = state.tasks.find((t) => t.id === 'T-005');
      expect(task?.status).toBe('available');
      expect(task?.owner).toBe('');
    });
  });

  describe('unblockTask', () => {
    it('moves a blocked task to Tasks as available', () => {
      const ok = manager.unblockTask('T-020', 'P1');
      expect(ok).toBe(true);
      const state = manager.read();
      expect(state.blocked.find((b) => b.id === 'T-020')).toBeUndefined();
      const task = state.tasks.find((t) => t.id === 'T-020');
      expect(task?.status).toBe('available');
      expect(task?.pri).toBe('P1');
    });

    it('returns false for nonexistent blocked task', () => {
      expect(manager.unblockTask('T-999')).toBe(false);
    });
  });

  // ---- File claims ----

  describe('claimFiles / releaseFiles', () => {
    it('sets files on an agent', () => {
      manager.claimFiles('agent-edit', ['apps/api/**', 'packages/core/**']);
      const state = manager.read();
      const agent = state.agents.find((a) => a.id === 'agent-edit');
      expect(agent?.files).toBe('apps/api/**, packages/core/**');
    });

    it('clears files on an agent', () => {
      manager.releaseFiles('agent-edit');
      const state = manager.read();
      const agent = state.agents.find((a) => a.id === 'agent-edit');
      expect(agent?.files).toBe('');
    });
  });

  // ---- Log ----

  describe('addLogEntry', () => {
    it('prepends a log entry', () => {
      manager.addLogEntry('agent-edit', 'finished T-009');
      const state = manager.read();
      expect(state.log[0]).toContain('agent-edit');
      expect(state.log[0]).toContain('finished T-009');
    });

    it('caps log at 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        manager.addLogEntry('agent-test', `entry ${i}`);
      }
      const state = manager.read();
      expect(state.log.length).toBeLessThanOrEqual(20);
    });
  });

  // ---- Queries ----

  describe('detectStale', () => {
    it('returns agents older than 4h', () => {
      manager.updateAgent('agent-edit', { updated: '2020-01-01T00:00Z' });
      manager.updateAgent('agent-system', { updated: new Date().toISOString() });
      const stale = manager.detectStale();
      expect(stale.find((a) => a.id === 'agent-edit')).toBeDefined();
      expect(stale.find((a) => a.id === 'agent-system')).toBeUndefined();
    });

    it('uses shorter threshold for (starting) agents', () => {
      manager.updateAgent('agent-system', {
        task: '(starting)',
        updated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      });
      const stale = manager.detectStale();
      expect(stale.find((a) => a.id === 'agent-system')).toBeDefined();
    });
  });

  describe('checkConflicts', () => {
    it('detects file overlap', () => {
      const result = manager.checkConflicts('agent-system', ['packages/harnesses/src/new.ts']);
      expect(result.clean).toBe(false);
      expect(result.conflicts[0].otherSession).toBe('agent-edit');
    });

    it('returns clean when no overlap', () => {
      const result = manager.checkConflicts('agent-edit', ['packages/cli/src/new.ts']);
      expect(result.clean).toBe(true);
    });
  });

  describe('getClaimedTasks', () => {
    it('returns tasks claimed by a specific agent', () => {
      const tasks = manager.getClaimedTasks('agent-edit');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('T-009');
    });

    it('returns empty for agent with no claimed tasks', () => {
      expect(manager.getClaimedTasks('nonexistent')).toHaveLength(0);
    });
  });

  // ---- Round-trip serialization ----

  describe('round-trip', () => {
    it('preserves all sections through write + read', () => {
      const before = manager.read();
      manager.write(before);
      const after = manager.read();

      expect(after.agents).toHaveLength(before.agents.length);
      expect(after.tasks).toHaveLength(before.tasks.length);
      expect(after.blocked).toHaveLength(before.blocked.length);
      expect(after.done).toHaveLength(before.done.length);
      expect(after.log).toHaveLength(before.log.length);
    });

    it('serializes to v2 format even from v1 input', () => {
      writeFileSync(workboardPath, V1_FIXTURE, 'utf8');
      const state = manager.read();
      manager.write(state);
      const after = manager.read();
      expect(after.agents).toHaveLength(2);
      expect(after.agents[0].id).toBe('terminal-1');
    });
  });
});
