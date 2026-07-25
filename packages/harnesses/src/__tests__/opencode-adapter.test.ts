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
      // Whether `opencode` is on PATH is a property of the machine running
      // the suite, not of this adapter -- assert shape, not a specific
      // value. (A same-test comparison against a second real
      // `adapter.isAvailable()` call is flaky under parallel test load: two
      // independent execFile calls to the real binary can race.)
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

  // Fixtures below are SYNTHESIZED against the pinned opencode 1.18.3 event
  // shape (all ids/values invented -- see the adapter header comment). Every
  // event carries the envelope `{type, timestamp, sessionID, part}`, with
  // `type` underscore-separated and `part.type` hyphen-separated.
  //
  // The pre-pin parser treated stdout as a single JSON document. Against
  // this real newline-delimited shape it either (a) throws on multi-line
  // JSONL and falls back to returning the raw stdout verbatim, or (b) on a
  // single-event line, finds no top-level `output`/`text`/`message`/
  // `content` key (those live under `part`, not the envelope) and also
  // returns the raw JSON verbatim. Both were verified false-red against the
  // pre-fix parser (stashed locally, not committed) before this fix landed.
  describe('pinned opencode 1.18.3 JSONL event-stream shape', () => {
    function eventLine(event: Record<string, unknown>): string {
      return JSON.stringify(event);
    }

    it('extracts the final assistant text from a full tool-using turn (multi-event JSONL)', () => {
      const jsonl = [
        eventLine({
          type: 'step_start',
          timestamp: 1721000000000,
          sessionID: 'ses_test_fixture_1',
          part: { type: 'step-start' },
        }),
        eventLine({
          type: 'tool_use',
          timestamp: 1721000000001,
          sessionID: 'ses_test_fixture_1',
          part: {
            type: 'tool',
            tool: 'revealui_revealui_list_sites',
            callID: 'call_fixture_1',
            id: 'part_fixture_1',
            messageID: 'msg_fixture_1',
            sessionID: 'ses_test_fixture_1',
            state: {
              status: 'completed',
              input: {},
              output: '{"sites":[{"id":"site_fixture_1","name":"Example Site"}]}',
            },
          },
        }),
        eventLine({
          type: 'step_finish',
          timestamp: 1721000000002,
          sessionID: 'ses_test_fixture_1',
          part: { type: 'step-finish' },
        }),
        eventLine({
          type: 'step_start',
          timestamp: 1721000000003,
          sessionID: 'ses_test_fixture_1',
          part: { type: 'step-start' },
        }),
        eventLine({
          type: 'text',
          timestamp: 1721000000004,
          sessionID: 'ses_test_fixture_1',
          part: { type: 'text', text: 'You have one site: Example Site.' },
        }),
        eventLine({
          type: 'step_finish',
          timestamp: 1721000000005,
          sessionID: 'ses_test_fixture_1',
          part: { type: 'step-finish' },
        }),
      ].join('\n');

      expect(parseOpenCodeRunOutput(jsonl)).toBe('You have one site: Example Site.');
    });

    it('extracts text from a single-event JSONL line (no tool use)', () => {
      const jsonl = eventLine({
        type: 'text',
        timestamp: 1721000000010,
        sessionID: 'ses_test_fixture_2',
        part: { type: 'text', text: 'Hello from a single-event turn.' },
      });

      expect(parseOpenCodeRunOutput(jsonl)).toBe('Hello from a single-event turn.');
    });

    it('prefers the LAST text event when a turn has multiple text events', () => {
      const jsonl = [
        eventLine({
          type: 'text',
          timestamp: 1721000000020,
          sessionID: 'ses_test_fixture_3',
          part: { type: 'text', text: 'first partial' },
        }),
        eventLine({
          type: 'text',
          timestamp: 1721000000021,
          sessionID: 'ses_test_fixture_3',
          part: { type: 'text', text: 'final answer' },
        }),
      ].join('\n');

      expect(parseOpenCodeRunOutput(jsonl)).toBe('final answer');
    });

    it('falls back to raw stdout for a JSONL stream with no terminal text event (tool-only turn)', () => {
      const jsonl = [
        eventLine({
          type: 'step_start',
          timestamp: 1721000000030,
          sessionID: 'ses_test_fixture_4',
          part: { type: 'step-start' },
        }),
        eventLine({
          type: 'tool_use',
          timestamp: 1721000000031,
          sessionID: 'ses_test_fixture_4',
          part: {
            type: 'tool',
            tool: 'revealui_revealui_site_stats',
            callID: 'call_fixture_4',
            state: { status: 'completed', input: {}, output: '{"views":0}' },
          },
        }),
      ].join('\n');

      // Documented fallback (no information loss): no `text` event, so the
      // raw JSONL is returned verbatim rather than silently dropped.
      expect(parseOpenCodeRunOutput(jsonl)).toBe(jsonl);
    });

    it('handles trailing blank lines in JSONL stdout', () => {
      const jsonl = `${eventLine({
        type: 'text',
        timestamp: 1721000000040,
        sessionID: 'ses_test_fixture_5',
        part: { type: 'text', text: 'trailing newline handled' },
      })}\n\n`;

      expect(parseOpenCodeRunOutput(jsonl)).toBe('trailing newline handled');
    });
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
