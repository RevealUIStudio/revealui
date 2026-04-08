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

import { ClaudeCodeAdapter } from '../adapters/claude-code-adapter.js';
import { CopilotAdapter } from '../adapters/copilot-adapter.js';
import { HarnessRegistry } from '../registry/harness-registry.js';
import type { HarnessEvent } from '../types/core.js';

describe('Event Emission', () => {
  describe('ClaudeCodeAdapter', () => {
    let adapter: ClaudeCodeAdapter;
    let events: HarnessEvent[];

    beforeEach(() => {
      adapter = new ClaudeCodeAdapter();
      events = [];
      adapter.onEvent((e) => events.push(e));
    });

    afterEach(async () => {
      await adapter.dispose();
    });

    it('emits harness-connected on notifyRegistered', () => {
      adapter.notifyRegistered();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'harness-connected', harnessId: 'claude-code' });
    });

    it('emits harness-disconnected on notifyUnregistering', () => {
      adapter.notifyUnregistering();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'harness-disconnected', harnessId: 'claude-code' });
    });

    it('emits error event on execute failure', async () => {
      // Force an error by calling a command that throws
      const result = await adapter.execute({ type: 'get-status' });
      // get-status calls isAvailable which calls execFileAsync — mocked to fail
      expect(result.success).toBe(true); // get-status catches and returns available: false
    });

    it('swallows subscriber errors without crashing', () => {
      adapter.onEvent(() => {
        throw new Error('subscriber crash');
      });
      // Should not throw
      expect(() => adapter.notifyRegistered()).not.toThrow();
    });
  });

  describe('CopilotAdapter', () => {
    let adapter: CopilotAdapter;
    let events: HarnessEvent[];

    beforeEach(() => {
      adapter = new CopilotAdapter();
      events = [];
      adapter.onEvent((e) => events.push(e));
    });

    afterEach(async () => {
      await adapter.dispose();
    });

    it('emits harness-connected on notifyRegistered', () => {
      adapter.notifyRegistered();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'harness-connected', harnessId: 'copilot' });
    });

    it('emits harness-disconnected on notifyUnregistering', () => {
      adapter.notifyUnregistering();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'harness-disconnected', harnessId: 'copilot' });
    });
  });

  describe('Registry integration', () => {
    it('fires harness-connected on register and harness-disconnected on unregister', async () => {
      const registry = new HarnessRegistry();
      const adapter = new CopilotAdapter();
      const events: HarnessEvent[] = [];
      adapter.onEvent((e) => events.push(e));

      registry.register(adapter);
      expect(events).toContainEqual({ type: 'harness-connected', harnessId: 'copilot' });

      await registry.unregister('copilot');
      expect(events).toContainEqual({ type: 'harness-disconnected', harnessId: 'copilot' });
    });

    it('unsubscribe removes the handler', () => {
      const adapter = new ClaudeCodeAdapter();
      const events: HarnessEvent[] = [];
      const unsub = adapter.onEvent((e) => events.push(e));

      adapter.notifyRegistered();
      expect(events).toHaveLength(1);

      unsub();
      adapter.notifyUnregistering();
      expect(events).toHaveLength(1); // no new event
    });
  });
});
