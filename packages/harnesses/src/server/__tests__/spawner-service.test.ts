/**
 * Tests for SpawnerService process termination (GAP-353 D6 / §7 R2).
 *
 * `node:child_process` spawn is mocked to launch a real child running the
 * SIGTERM-ignoring fixture regardless of backend, so the SIGTERM -> grace ->
 * SIGKILL escalation and the event-driven status transition can be exercised
 * against a genuinely wedged process.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const { fileURLToPath } = await import('node:url');
  const fixturePath = fileURLToPath(new URL('./fixtures/ignore-sigterm.mjs', import.meta.url));
  return {
    ...actual,
    spawn: vi.fn(() =>
      actual.spawn(process.execPath, [fixturePath], { stdio: ['ignore', 'pipe', 'pipe'] }),
    ),
  };
});

import type { AgentExitEvent, AgentOutputEvent } from '../spawner-service.js';
import { SpawnerService } from '../spawner-service.js';

function waitReady(service: SpawnerService): Promise<void> {
  return new Promise<void>((resolve) => {
    const onOutput = (event: AgentOutputEvent): void => {
      if (event.data.includes('ready')) {
        service.off('output', onOutput);
        resolve();
      }
    };
    service.on('output', onOutput);
  });
}

function onceExit(service: SpawnerService): Promise<AgentExitEvent> {
  return new Promise<AgentExitEvent>((resolve) => service.once('exit', resolve));
}

describe('SpawnerService termination (D6)', () => {
  let service: SpawnerService;

  afterEach(async () => {
    // Reap any still-running child so a failed assertion cannot orphan it.
    const running = service.list().some((s) => s.status === 'running');
    if (running) {
      const exited = onceExit(service);
      service.stopAll();
      await exited;
    }
  });

  it('escalates SIGTERM to SIGKILL for a child that ignores SIGTERM', async () => {
    service = new SpawnerService({ terminationGraceMs: 150 });
    const id = service.spawn('wedged', 'Ollama', 'model', 'prompt');
    await waitReady(service);

    const exited = onceExit(service);
    const start = Date.now();
    service.stop(id);

    // Event-driven status: still running immediately after stop(), never a
    // synchronous 'stopped' lie.
    expect(service.list()[0]?.status).toBe('running');

    const event = await exited;
    // The child ignored SIGTERM, so it only exited once SIGKILL landed after the
    // grace period.
    expect(Date.now() - start).toBeGreaterThanOrEqual(150);
    expect(event.code).toBeNull();
    const finalStatus = service.list()[0]?.status;
    expect(finalStatus).not.toBe('running');
    expect(['stopped', 'errored']).toContain(finalStatus);
  });

  it('keeps status running immediately after stop() on a live child', async () => {
    service = new SpawnerService({ terminationGraceMs: 100 });
    const id = service.spawn('wedged', 'Ollama', 'model', 'prompt');
    await waitReady(service);

    const exited = onceExit(service);
    service.stop(id);
    expect(service.list()[0]?.status).toBe('running');

    // Reap via the SIGKILL escalation.
    await exited;
    expect(service.list()[0]?.status).not.toBe('running');
  });

  it('stopAll escalates and does not lie about status', async () => {
    service = new SpawnerService({ terminationGraceMs: 120 });
    service.spawn('wedged', 'Ollama', 'model', 'prompt');
    await waitReady(service);

    const exited = onceExit(service);
    service.stopAll();
    expect(service.list()[0]?.status).toBe('running');

    await exited;
    expect(service.list()[0]?.status).not.toBe('running');
  });
});
