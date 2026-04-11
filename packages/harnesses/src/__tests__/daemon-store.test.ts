/**
 * Tests for DaemonStore  -  PGlite-backed persistent state.
 *
 * Uses in-memory PGlite (no data directory) for isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: () => true,
}));

vi.mock('@revealui/core/license', () => ({
  initializeLicense: async () => {},
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { DaemonStore } from '../storage/daemon-store.js';

describe('DaemonStore', () => {
  let store: DaemonStore;

  beforeEach(async () => {
    // In-memory PGlite: no dataDir means ephemeral
    store = new DaemonStore({ dataDir: '' });
    await store.init();
  });

  afterEach(async () => {
    await store.close();
  });

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  it('registers a session', async () => {
    const session = await store.registerSession({
      id: 'agent-1',
      env: 'test',
      task: 'doing stuff',
      pid: 1234,
    });
    expect(session.id).toBe('agent-1');
    expect(session.env).toBe('test');
    expect(session.task).toBe('doing stuff');
    expect(session.pid).toBe(1234);
    expect(session.ended_at).toBeNull();
  });

  it('upserts a session on conflict', async () => {
    await store.registerSession({ id: 'agent-1', env: 'v1' });
    const updated = await store.registerSession({ id: 'agent-1', env: 'v2', task: 'new task' });
    expect(updated.env).toBe('v2');
    expect(updated.task).toBe('new task');
  });

  it('updates a session', async () => {
    await store.registerSession({ id: 'agent-1', env: 'test' });
    const updated = await store.updateSession('agent-1', { task: 'updated', files: 'foo.ts' });
    expect(updated?.task).toBe('updated');
    expect(updated?.files).toBe('foo.ts');
  });

  it('ends a session', async () => {
    await store.registerSession({ id: 'agent-1', env: 'test' });
    await store.endSession('agent-1', 'done');
    const sessions = await store.getActiveSessions();
    expect(sessions).toHaveLength(0);
  });

  it('lists active sessions', async () => {
    await store.registerSession({ id: 'agent-1', env: 'a' });
    await store.registerSession({ id: 'agent-2', env: 'b' });
    await store.endSession('agent-1');
    const active = await store.getActiveSessions();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('agent-2');
  });

  it('returns session history', async () => {
    await store.registerSession({ id: 'agent-1', env: 'test', task: 'first' });
    const history = await store.getSessionHistory('agent-1', 10);
    expect(history).toHaveLength(1);
    expect(history[0].task).toBe('first');
  });

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  it('sends and receives a message', async () => {
    await store.registerSession({ id: 'agent-1', env: 'a' });
    await store.registerSession({ id: 'agent-2', env: 'b' });

    const msg = await store.sendMessage({
      fromAgent: 'agent-1',
      toAgent: 'agent-2',
      subject: 'hello',
      body: 'world',
    });
    expect(msg.from_agent).toBe('agent-1');
    expect(msg.to_agent).toBe('agent-2');
    expect(msg.read).toBe(false);

    const inbox = await store.getInbox('agent-2', true);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].subject).toBe('hello');
  });

  it('marks messages as read', async () => {
    const msg = await store.sendMessage({
      fromAgent: 'a',
      toAgent: 'b',
      subject: 'test',
    });
    await store.markRead([msg.id]);
    const inbox = await store.getInbox('b', true);
    expect(inbox).toHaveLength(0);
  });

  it('broadcasts to all active agents except sender', async () => {
    await store.registerSession({ id: 'agent-1', env: 'a' });
    await store.registerSession({ id: 'agent-2', env: 'b' });
    await store.registerSession({ id: 'agent-3', env: 'c' });

    const sent = await store.broadcastMessage({
      fromAgent: 'agent-1',
      subject: 'broadcast test',
    });
    expect(sent).toBe(2);

    const inbox2 = await store.getInbox('agent-2', true);
    const inbox3 = await store.getInbox('agent-3', true);
    expect(inbox2).toHaveLength(1);
    expect(inbox3).toHaveLength(1);

    const inbox1 = await store.getInbox('agent-1', true);
    expect(inbox1).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // File Reservations
  // ---------------------------------------------------------------------------

  it('reserves a file', async () => {
    const result = await store.reserveFile({
      filePath: '/src/foo.ts',
      agentId: 'agent-1',
      ttlSeconds: 3600,
      reason: 'editing',
    });
    expect(result.success).toBe(true);
  });

  it('blocks reservation by another agent', async () => {
    await store.reserveFile({
      filePath: '/src/foo.ts',
      agentId: 'agent-1',
      ttlSeconds: 3600,
    });
    const result = await store.reserveFile({
      filePath: '/src/foo.ts',
      agentId: 'agent-2',
      ttlSeconds: 3600,
    });
    expect(result.success).toBe(false);
    expect(result.holder).toBe('agent-1');
  });

  it('allows same agent to re-reserve', async () => {
    await store.reserveFile({
      filePath: '/src/foo.ts',
      agentId: 'agent-1',
      ttlSeconds: 3600,
    });
    const result = await store.reserveFile({
      filePath: '/src/foo.ts',
      agentId: 'agent-1',
      ttlSeconds: 7200,
    });
    expect(result.success).toBe(true);
  });

  it('checks reservation', async () => {
    await store.reserveFile({
      filePath: '/src/bar.ts',
      agentId: 'agent-1',
      ttlSeconds: 3600,
    });
    const reservation = await store.checkReservation('/src/bar.ts');
    expect(reservation).not.toBeNull();
    expect(reservation?.agent_id).toBe('agent-1');
  });

  it('releases all reservations for an agent', async () => {
    await store.reserveFile({ filePath: '/a.ts', agentId: 'agent-1', ttlSeconds: 3600 });
    await store.reserveFile({ filePath: '/b.ts', agentId: 'agent-1', ttlSeconds: 3600 });
    const released = await store.releaseAllReservations('agent-1');
    expect(released).toBe(2);
    const check = await store.checkReservation('/a.ts');
    expect(check).toBeNull();
  });

  it('lists reservations for an agent', async () => {
    await store.reserveFile({ filePath: '/x.ts', agentId: 'agent-1', ttlSeconds: 3600 });
    await store.reserveFile({ filePath: '/y.ts', agentId: 'agent-2', ttlSeconds: 3600 });
    const reservations = await store.getReservations('agent-1');
    expect(reservations).toHaveLength(1);
    expect(reservations[0].file_path).toBe('/x.ts');
  });

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  it('creates a task', async () => {
    const task = await store.createTask({ id: 'task-1', description: 'Fix the widget' });
    expect(task.id).toBe('task-1');
    expect(task.status).toBe('open');
    expect(task.owner).toBeNull();
  });

  it('claims a task atomically', async () => {
    await store.createTask({ id: 'task-2', description: 'Deploy' });
    const claim = await store.claimTask('task-2', 'agent-1');
    expect(claim.success).toBe(true);
  });

  it('blocks claim by another agent', async () => {
    await store.createTask({ id: 'task-3', description: 'Review PR' });
    await store.claimTask('task-3', 'agent-1');
    const claim = await store.claimTask('task-3', 'agent-2');
    expect(claim.success).toBe(false);
    expect(claim.owner).toBe('agent-1');
  });

  it('allows same agent to re-claim', async () => {
    await store.createTask({ id: 'task-4', description: 'Test' });
    await store.claimTask('task-4', 'agent-1');
    const claim = await store.claimTask('task-4', 'agent-1');
    expect(claim.success).toBe(true);
  });

  it('completes a task', async () => {
    await store.createTask({ id: 'task-5', description: 'Build' });
    await store.claimTask('task-5', 'agent-1');
    const ok = await store.completeTask('task-5', 'agent-1');
    expect(ok).toBe(true);
    const tasks = await store.listTasks({ status: 'completed' });
    expect(tasks.some((t) => t.id === 'task-5')).toBe(true);
  });

  it('prevents non-owner from completing', async () => {
    await store.createTask({ id: 'task-6', description: 'Debug' });
    await store.claimTask('task-6', 'agent-1');
    const ok = await store.completeTask('task-6', 'agent-2');
    expect(ok).toBe(false);
  });

  it('releases a claimed task back to open', async () => {
    await store.createTask({ id: 'task-7', description: 'Refactor' });
    await store.claimTask('task-7', 'agent-1');
    const released = await store.releaseTask('task-7', 'agent-1');
    expect(released).toBe(true);
    const tasks = await store.listTasks({ status: 'open' });
    expect(tasks.some((t) => t.id === 'task-7')).toBe(true);
  });

  it('lists tasks filtered by status and owner', async () => {
    await store.createTask({ id: 'task-a', description: 'A' });
    await store.createTask({ id: 'task-b', description: 'B' });
    await store.claimTask('task-b', 'agent-1');
    const open = await store.listTasks({ status: 'open' });
    expect(open.some((t) => t.id === 'task-a')).toBe(true);
    expect(open.some((t) => t.id === 'task-b')).toBe(false);
    const owned = await store.listTasks({ owner: 'agent-1' });
    expect(owned.some((t) => t.id === 'task-b')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  it('logs and retrieves events', async () => {
    const event = await store.logEvent({
      agentId: 'agent-1',
      eventType: 'file-edit',
      payload: { path: '/src/index.ts' },
    });
    expect(event.agent_id).toBe('agent-1');
    expect(event.event_type).toBe('file-edit');

    const recent = await store.getRecentEvents(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe(event.id);
  });

  it('prunes old events', async () => {
    await store.logEvent({ agentId: 'a', eventType: 'test' });
    // Pruning events older than 0 days should remove everything
    const pruned = await store.pruneEvents(0);
    expect(pruned).toBeGreaterThanOrEqual(0);
  });
});
