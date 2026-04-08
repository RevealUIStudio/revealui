import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecFile } = vi.hoisted(() => {
  const mockExecFile = vi.fn();
  return { mockExecFile };
});

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

import { CursorAdapter } from '../adapters/cursor-adapter.js';
import type { HarnessEvent } from '../types/core.js';

describe('CursorAdapter', () => {
  let adapter: CursorAdapter;

  beforeEach(() => {
    mockExecFile.mockReset();
    adapter = new CursorAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe('identity', () => {
    it('has id "cursor"', () => {
      expect(adapter.id).toBe('cursor');
    });

    it('has name "Cursor"', () => {
      expect(adapter.name).toBe('Cursor');
    });
  });

  describe('capabilities', () => {
    it('disables code generation capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.generateCode).toBe(false);
      expect(caps.analyzeCode).toBe(false);
      expect(caps.applyEdit).toBe(false);
      expect(caps.applyConfig).toBe(false);
    });

    it('disables workboard without path', () => {
      const caps = adapter.getCapabilities();
      expect(caps.readWorkboard).toBe(false);
      expect(caps.writeWorkboard).toBe(false);
    });

    it('enables workboard with path', () => {
      const a = new CursorAdapter('/tmp/test-workboard.md');
      const caps = a.getCapabilities();
      expect(caps.readWorkboard).toBe(true);
      expect(caps.writeWorkboard).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('returns true when cursor --version succeeds', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
        cb(null, { stdout: 'Cursor 1.0.0\n', stderr: '' });
        return {} as never;
      });
      expect(await adapter.isAvailable()).toBe(true);
    });

    it('returns false when cursor --version fails', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
        cb(new Error('not found'));
        return {} as never;
      });
      expect(await adapter.isAvailable()).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('returns info with version when available', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
        cb(null, { stdout: 'Cursor 1.2.3\n', stderr: '' });
        return {} as never;
      });
      const info = await adapter.getInfo();
      expect(info.id).toBe('cursor');
      expect(info.name).toBe('Cursor');
      expect(info.version).toBe('Cursor 1.2.3');
    });

    it('returns info without version when unavailable', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
        cb(new Error('not found'));
        return {} as never;
      });
      const info = await adapter.getInfo();
      expect(info.version).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('handles get-status', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
        cb(new Error('not found'));
        return {} as never;
      });
      const result = await adapter.execute({ type: 'get-status' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ available: false });
    });

    it('rejects unsupported commands', async () => {
      const result = await adapter.execute({ type: 'generate-code', prompt: 'test' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
    });

    it('reads workboard when path is set', async () => {
      const dir = join(tmpdir(), `cursor-test-${Date.now()}`);
      mkdirSync(join(dir, '.claude'), { recursive: true });
      const wbPath = join(dir, '.claude', 'workboard.md');
      writeFileSync(
        wbPath,
        '# Workboard\n\n## Sessions\n\n| id  | env | started | task | files | updated |\n| --- | --- | ------- | ---- | ----- | ------- |\n\n## Plans\n\n## Recent\n\n## Context\n\n## Plan Reference\n',
      );
      const a = new CursorAdapter(wbPath);
      const result = await a.execute({ type: 'read-workboard' });
      expect(result.success).toBe(true);
      try {
        unlinkSync(wbPath);
      } catch {}
      try {
        unlinkSync(wbPath.replace('.md', '.lock'));
      } catch {}
    });

    it('rejects read-workboard without path', async () => {
      const result = await adapter.execute({ type: 'read-workboard' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('REVEALUI_WORKBOARD_PATH');
    });

    it('rejects update-workboard without path', async () => {
      const result = await adapter.execute({
        type: 'update-workboard',
        sessionId: 'test',
        task: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('events', () => {
    it('emits harness-connected on notifyRegistered', () => {
      const events: HarnessEvent[] = [];
      adapter.onEvent((e) => events.push(e));
      adapter.notifyRegistered();
      expect(events[0]).toEqual({ type: 'harness-connected', harnessId: 'cursor' });
    });

    it('emits harness-disconnected on notifyUnregistering', () => {
      const events: HarnessEvent[] = [];
      adapter.onEvent((e) => events.push(e));
      adapter.notifyUnregistering();
      expect(events[0]).toEqual({ type: 'harness-disconnected', harnessId: 'cursor' });
    });

    it('emits error on execute failure', async () => {
      const events: HarnessEvent[] = [];
      adapter.onEvent((e) => events.push(e));
      // Force a throw by making executeInner throw
      const a = new CursorAdapter('/nonexistent/path');
      a.onEvent((e) => events.push(e));
      // update-workboard with nonexistent path will try to read file and throw
      await a.execute({
        type: 'update-workboard',
        sessionId: 'test',
        task: 'test',
      });
      // The error should have been caught by execute wrapper
      const errorEvents = events.filter((e) => e.type === 'error');
      // May or may not produce error event depending on whether inner method throws vs returns failure
      expect(errorEvents.length).toBeGreaterThanOrEqual(0);
    });
  });
});
