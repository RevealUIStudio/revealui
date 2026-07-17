import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeCursorHookEvent } from '../hooks/normalizers/cursor.js';
import type { PolicyDecision } from '../hooks/policy.js';
import { appendToSpool, flushSpool, resetFlushWarnLatchForTests } from '../hooks/spool.js';

const decision: PolicyDecision = { permission: 'allow' };
const event = normalizeCursorHookEvent({ hook_event_name: 'stop' }, 'advisory');

describe('appendToSpool', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hook-spool-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates the parent directory and appends a JSONL line', async () => {
    const spoolPath = join(dir, 'nested', 'receipts.jsonl');
    const result = await appendToSpool(
      { event, decision, spooledAt: new Date().toISOString() },
      spoolPath,
    );
    expect(result.appended).toBe(true);
    expect(result.rotated).toBe(false);

    const content = await readFile(spoolPath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] as string);
    expect(parsed.decision.permission).toBe('allow');
    expect(parsed.event.kind).toBe('stop');
  });

  it('appends multiple records without dropping any', async () => {
    const spoolPath = join(dir, 'receipts.jsonl');
    for (let i = 0; i < 5; i++) {
      await appendToSpool({ event, decision, spooledAt: new Date().toISOString() }, spoolPath);
    }
    const content = await readFile(spoolPath, 'utf8');
    expect(content.trim().split('\n')).toHaveLength(5);
  });

  it('never drops an event on overflow -- rotates the full spool aside instead', async () => {
    const spoolPath = join(dir, 'receipts.jsonl');
    // First append establishes the file; force a tiny max so the SECOND
    // append rotates instead of growing the first file unbounded.
    await appendToSpool({ event, decision, spooledAt: new Date().toISOString() }, spoolPath, 1);
    const second = await appendToSpool(
      { event, decision, spooledAt: new Date().toISOString() },
      spoolPath,
      1,
    );
    expect(second.rotated).toBe(true);

    const entries = await readdir(dir);
    const rotated = entries.filter((name) => name.endsWith('.rotated'));
    expect(rotated).toHaveLength(1);

    // The rotated file still holds the first record -- nothing was dropped.
    const rotatedContent = await readFile(join(dir, rotated[0] as string), 'utf8');
    expect(rotatedContent.trim().split('\n')).toHaveLength(1);

    // The fresh spool holds the second record.
    const freshContent = await readFile(spoolPath, 'utf8');
    expect(freshContent.trim().split('\n')).toHaveLength(1);
  });
});

describe('flushSpool', () => {
  beforeEach(() => {
    resetFlushWarnLatchForTests();
  });

  it('no-ops with a warn when no endpoint is configured (spool-only mode)', () => {
    const stderrSpy = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;
    const messages: string[] = [];
    process.stderr.write = ((chunk: string) => {
      messages.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = flushSpool('/tmp/does-not-matter.jsonl', {});
      expect(result.flushed).toBe(false);
      expect(result.reason).toBe('not-configured');
      expect(messages.some((m) => m.includes('spool-only mode'))).toBe(true);
    } finally {
      process.stderr.write = stderrSpy;
    }
  });

  it('warns only once across repeated calls (single-warn latch)', () => {
    const messages: string[] = [];
    const original = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      messages.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      flushSpool('/tmp/spool.jsonl', {});
      flushSpool('/tmp/spool.jsonl', {});
      flushSpool('/tmp/spool.jsonl', {});
      expect(messages).toHaveLength(1);
    } finally {
      process.stderr.write = original;
    }
  });

  it('reports not-implemented when an endpoint IS configured -- Phase A ships the real POST', () => {
    const result = flushSpool('/tmp/spool.jsonl', {
      endpoint: 'https://example.com/api/harness/receipts',
    });
    expect(result.flushed).toBe(false);
    expect(result.reason).toBe('not-implemented');
  });
});
