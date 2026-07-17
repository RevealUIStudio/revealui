import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  describeOpenCodeExecError,
  OpenCodeAdapter,
  parseOpenCodeRunOutput,
} from '../adapters/opencode-adapter.js';
import { HarnessRegistry } from '../registry/harness-registry.js';
import type { HarnessCommand, HarnessEvent } from '../types/core.js';

describe('OpenCodeAdapter', () => {
  let projectRoot: string;
  let adapter: OpenCodeAdapter;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'opencode-adapter-test-'));
    adapter = new OpenCodeAdapter({ projectRoot });
  });

  afterEach(async () => {
    await adapter.dispose();
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('has id opencode and a display name', () => {
    expect(adapter.id).toBe('opencode');
    expect(adapter.name).toBe('OpenCode');
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

  describe('isAvailable / getInfo -- graceful no-binary failure', () => {
    // `opencode` is not installed in this build environment (verified via
    // `which opencode` during the audit for this PR). These assertions
    // exercise the REAL execFile ENOENT path, not a mock.
    it('isAvailable returns false when the opencode binary is missing', async () => {
      const missing = new OpenCodeAdapter({ binaryPath: 'opencode-binary-that-does-not-exist' });
      await expect(missing.isAvailable()).resolves.toBe(false);
    });

    it('getInfo reports an undefined version when the binary is missing', async () => {
      const missing = new OpenCodeAdapter({ binaryPath: 'opencode-binary-that-does-not-exist' });
      const info = await missing.getInfo();
      expect(info.id).toBe('opencode');
      expect(info.version).toBeUndefined();
    });

    it('execute(headless-prompt) fails gracefully with a helpful message when unavailable', async () => {
      const missing = new OpenCodeAdapter({
        projectRoot,
        binaryPath: 'opencode-binary-that-does-not-exist',
      });
      const result = await missing.execute({ type: 'headless-prompt', prompt: 'hello' });
      expect(result.success).toBe(false);
      expect(result.command).toBe('headless-prompt');
      expect(result.message).toContain('opencode CLI not found on PATH');
    });

    it('emits a generation-started event even when the run ultimately fails', async () => {
      const missing = new OpenCodeAdapter({
        projectRoot,
        binaryPath: 'opencode-binary-that-does-not-exist',
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
      expect(data.available).toBe(false); // opencode not installed in this env
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
        sessionId: 'opencode-1',
      });
      expect(update.success).toBe(false);
      expect(update.message).toContain('not yet wired');
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
        configPath: 'opencode.json',
        content: '{"mcp":{}}',
      });
      expect(result.success).toBe(true);
      const written = await readFile(join(projectRoot, 'opencode.json'), 'utf8');
      expect(written).toBe('{"mcp":{}}');
    });

    it('apply-config creates nested directories', async () => {
      const result = await adapter.execute({
        type: 'apply-config',
        configPath: '.opencode/agents/reviewer.md',
        content: '---\ndescription: x\n---\n',
      });
      expect(result.success).toBe(true);
      const written = await readFile(
        join(projectRoot, '.opencode', 'agents', 'reviewer.md'),
        'utf8',
      );
      expect(written).toContain('description: x');
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

    it('diff-config reports both sides missing when nothing is configured locally', async () => {
      const result = await adapter.execute({ type: 'diff-config' });
      expect(result.success).toBe(true);
      expect(result.command).toBe('diff-config');
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
      expect(registry.get('opencode')).toBe(adapter);
    });

    it('throws on duplicate registration', () => {
      registry.register(adapter);
      expect(() => registry.register(new OpenCodeAdapter())).toThrow('already registered');
    });

    it('unregisters and disposes the adapter', async () => {
      registry.register(adapter);
      await registry.unregister('opencode');
      expect(registry.get('opencode')).toBeUndefined();
    });

    it('reports unavailable in listAvailable() when the binary is missing', async () => {
      const missing = new OpenCodeAdapter({ binaryPath: 'opencode-binary-that-does-not-exist' });
      registry.register(missing);
      const available = await registry.listAvailable();
      expect(available).not.toContain('opencode');
    });
  });

  describe('notifyRegistered / notifyUnregistering', () => {
    it('emits harness-connected and harness-disconnected', () => {
      const events: HarnessEvent[] = [];
      adapter.onEvent((e) => events.push(e));
      adapter.notifyRegistered();
      adapter.notifyUnregistering();
      expect(events).toEqual([
        { type: 'harness-connected', harnessId: 'opencode' },
        { type: 'harness-disconnected', harnessId: 'opencode' },
      ]);
    });
  });
});

describe('parseOpenCodeRunOutput', () => {
  it('returns empty string for empty stdout', () => {
    expect(parseOpenCodeRunOutput('')).toBe('');
    expect(parseOpenCodeRunOutput('   \n  ')).toBe('');
  });

  it('extracts a known text-bearing key from a JSON object', () => {
    expect(parseOpenCodeRunOutput(JSON.stringify({ output: 'hello' }))).toBe('hello');
    expect(parseOpenCodeRunOutput(JSON.stringify({ text: 'hi' }))).toBe('hi');
    expect(parseOpenCodeRunOutput(JSON.stringify({ message: 'hey' }))).toBe('hey');
    expect(parseOpenCodeRunOutput(JSON.stringify({ content: 'yo' }))).toBe('yo');
  });

  it('prefers the first matching key in priority order', () => {
    expect(parseOpenCodeRunOutput(JSON.stringify({ output: 'first', text: 'second' }))).toBe(
      'first',
    );
  });

  it('falls back to the raw JSON text for an unrecognized object shape', () => {
    const raw = JSON.stringify({ unknownField: 'value' });
    expect(parseOpenCodeRunOutput(raw)).toBe(raw);
  });

  it('unwraps a bare JSON string', () => {
    expect(parseOpenCodeRunOutput(JSON.stringify('plain string result'))).toBe(
      'plain string result',
    );
  });

  it('treats non-JSON stdout as plain text', () => {
    expect(parseOpenCodeRunOutput('just plain text, not json')).toBe('just plain text, not json');
  });
});

describe('describeOpenCodeExecError', () => {
  it('gives a helpful message for ENOENT (binary not on PATH)', () => {
    const err = Object.assign(new Error('spawn opencode ENOENT'), { code: 'ENOENT' });
    expect(describeOpenCodeExecError(err)).toContain('opencode CLI not found on PATH');
  });

  it('includes stderr when present', () => {
    const err = Object.assign(new Error('Command failed'), { stderr: 'boom' });
    expect(describeOpenCodeExecError(err)).toBe('Command failed\nboom');
  });

  it('falls back to the error message alone when there is no stderr', () => {
    expect(describeOpenCodeExecError(new Error('plain failure'))).toBe('plain failure');
  });

  it('stringifies non-Error throwables', () => {
    expect(describeOpenCodeExecError('a string error')).toBe('a string error');
  });
});
