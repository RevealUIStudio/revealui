import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  describeGrokExecError,
  GrokAdapter,
  parseGrokSingleOutput,
} from '../adapters/grok-adapter.js';
import { HarnessRegistry } from '../registry/harness-registry.js';
import type { HarnessCommand, HarnessEvent } from '../types/core.js';

describe('GrokAdapter', () => {
  let projectRoot: string;
  let adapter: GrokAdapter;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'grok-adapter-test-'));
    adapter = new GrokAdapter({ projectRoot });
  });

  afterEach(async () => {
    await adapter.dispose();
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('has id grok and a display name', () => {
    expect(adapter.id).toBe('grok');
    expect(adapter.name).toBe('Grok');
  });

  describe('getCapabilities', () => {
    it('declares generate/analyze/config support but not edit or workboard', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toEqual({
        generateCode: true,
        analyzeCode: true,
        applyEdit: false,
        applyConfig: true,
        readWorkboard: false,
        writeWorkboard: false,
      });
    });
  });

  describe('parseGrokSingleOutput', () => {
    it('returns empty string for blank stdout', () => {
      expect(parseGrokSingleOutput('')).toBe('');
      expect(parseGrokSingleOutput('   \n')).toBe('');
    });

    it('extracts known text-bearing JSON keys', () => {
      expect(parseGrokSingleOutput('{"result":"hello"}')).toBe('hello');
      expect(parseGrokSingleOutput('{"output":"out"}')).toBe('out');
      expect(parseGrokSingleOutput('{"text":"plain"}')).toBe('plain');
    });

    it('returns trimmed stdout when JSON has no known key', () => {
      expect(parseGrokSingleOutput('{"foo":1}')).toBe('{"foo":1}');
    });

    it('returns trimmed stdout when not JSON', () => {
      expect(parseGrokSingleOutput('  not json  \n')).toBe('not json');
    });
  });

  describe('describeGrokExecError', () => {
    it('special-cases ENOENT', () => {
      expect(describeGrokExecError({ code: 'ENOENT' })).toContain('grok CLI not found');
      expect(describeGrokExecError({ code: 'ENOENT' })).toContain('rfg');
    });
  });

  describe('isAvailable / getInfo -- graceful no-binary failure', () => {
    it('isAvailable returns false when the grok binary is missing', async () => {
      const missing = new GrokAdapter({ binaryPath: 'grok-binary-that-does-not-exist' });
      await expect(missing.isAvailable()).resolves.toBe(false);
    });

    it('getInfo reports an undefined version when the binary is missing', async () => {
      const missing = new GrokAdapter({ binaryPath: 'grok-binary-that-does-not-exist' });
      const info = await missing.getInfo();
      expect(info.id).toBe('grok');
      expect(info.version).toBeUndefined();
    });

    it('execute(headless-prompt) fails gracefully when unavailable', async () => {
      const missing = new GrokAdapter({
        projectRoot,
        binaryPath: 'grok-binary-that-does-not-exist',
      });
      const result = await missing.execute({ type: 'headless-prompt', prompt: 'hello' });
      expect(result.success).toBe(false);
      expect(result.command).toBe('headless-prompt');
      expect(result.message).toContain('grok CLI not found on PATH');
    });

    it('emits a generation-started event even when the run ultimately fails', async () => {
      const missing = new GrokAdapter({
        projectRoot,
        binaryPath: 'grok-binary-that-does-not-exist',
      });
      const events: HarnessEvent[] = [];
      missing.onEvent((e) => events.push(e));
      await missing.execute({ type: 'generate-code', prompt: 'write a function' });
      expect(events.some((e) => e.type === 'generation-started')).toBe(true);
      expect(events.some((e) => e.type === 'generation-completed')).toBe(false);
    });
  });

  describe('execute -- command mapping', () => {
    it('get-status reports availability and config', async () => {
      const result = await adapter.execute({ type: 'get-status' });
      expect(result.success).toBe(true);
      expect(result.command).toBe('get-status');
      const data = result.data as { available: boolean; projectRoot: string };
      expect(typeof data.available).toBe('boolean');
      expect(data.projectRoot).toBe(projectRoot);
    });

    it('apply-edit is explicitly unsupported', async () => {
      const result = await adapter.execute({
        type: 'apply-edit',
        filePath: 'foo.ts',
        diff: 'x',
      });
      expect(result.success).toBe(false);
      expect(result.command).toBe('apply-edit');
      expect(result.message).toContain('not supported');
    });

    it('read-workboard and update-workboard report the not-wired posture', async () => {
      const read = await adapter.execute({ type: 'read-workboard' });
      expect(read.success).toBe(false);
      expect(read.message).toContain('not yet wired');

      const update = await adapter.execute({
        type: 'update-workboard',
        sessionId: 'grok-1',
      });
      expect(update.success).toBe(false);
    });

    it('get-running-instances succeeds even with zero running processes', async () => {
      const result = await adapter.execute({ type: 'get-running-instances' });
      expect(result.success).toBe(true);
      const data = result.data as { instances: unknown[] };
      expect(Array.isArray(data.instances)).toBe(true);
    });

    it('apply-config writes content under the project root', async () => {
      const result = await adapter.execute({
        type: 'apply-config',
        configPath: '.grok/config.toml',
        content: '[ui]\nscreen_mode = "minimal"\n',
      });
      expect(result.success).toBe(true);
      const written = await readFile(join(projectRoot, '.grok', 'config.toml'), 'utf8');
      expect(written).toContain('screen_mode');
    });

    it('apply-config refuses to write outside the project root', async () => {
      const result = await adapter.execute({
        type: 'apply-config',
        configPath: '../../etc/passwd',
        content: 'malicious',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('outside the project root');
    });

    it('an unknown command type is reported as unsupported', async () => {
      const bogus = { type: 'not-a-real-command' } as unknown as HarnessCommand;
      const result = await adapter.execute(bogus);
      expect(result.success).toBe(false);
    });
  });

  describe('registry lifecycle', () => {
    let registry: HarnessRegistry;

    beforeEach(() => {
      registry = new HarnessRegistry();
    });

    afterEach(async () => {
      await registry.disposeAll();
    });

    it('registers the adapter', () => {
      registry.register(adapter);
      expect(registry.get('grok')).toBe(adapter);
    });

    it('throws on duplicate registration', () => {
      registry.register(adapter);
      expect(() => registry.register(new GrokAdapter())).toThrow('already registered');
    });

    it('unregisters and disposes the adapter', async () => {
      registry.register(adapter);
      await registry.unregister('grok');
      expect(registry.get('grok')).toBeUndefined();
    });

    it('reports unavailable in listAvailable() when the binary is missing', async () => {
      const missing = new GrokAdapter({ binaryPath: 'grok-binary-that-does-not-exist' });
      registry.register(missing);
      const available = await registry.listAvailable();
      expect(available).not.toContain('grok');
    });
  });

  describe('notifyRegistered / notifyUnregistering', () => {
    it('emits harness-connected and harness-disconnected', () => {
      const events: HarnessEvent[] = [];
      adapter.onEvent((e) => events.push(e));
      adapter.notifyRegistered();
      adapter.notifyUnregistering();
      expect(events).toEqual([
        { type: 'harness-connected', harnessId: 'grok' },
        { type: 'harness-disconnected', harnessId: 'grok' },
      ]);
    });
  });
});
