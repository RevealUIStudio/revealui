import { describe, expect, it } from 'vitest';
import { signActionLog } from '../receipt/sign.js';
import { verifyReceipt } from '../receipt/verify.js';
import type { ActionLogEntry, RunContext } from '../types.js';

const runContext: RunContext = {
  actorId: 'actor-abc123',
  actorRunId: 'run-xyz789',
  actorBuildId: 'build-def456',
};

const sampleActionLog: ActionLogEntry[] = [
  {
    index: 0,
    type: 'model_call',
    timestamp: '2026-07-26T00:00:00.000Z',
    detail: { content: 'thinking...', finishReason: 'tool_calls' },
  },
  {
    index: 1,
    type: 'tool_call',
    timestamp: '2026-07-26T00:00:01.000Z',
    detail: { toolName: 'web_fetch', params: { url: 'https://example.com' }, success: true },
  },
  {
    index: 2,
    type: 'final_output',
    timestamp: '2026-07-26T00:00:02.000Z',
    detail: { output: 'done', stopReason: 'completed' },
  },
];

describe('signActionLog / verifyReceipt roundtrip', () => {
  it('signs an action log and verifies it as valid', () => {
    const receipt = signActionLog(sampleActionLog, runContext);

    expect(receipt.algorithm).toBe('ed25519');
    expect(receipt.actionLog).toEqual(sampleActionLog);
    expect(receipt.signature).toMatch(/^v1\.ed25519\.[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
    expect(receipt.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(receipt.actorId).toBe(runContext.actorId);
    expect(receipt.actorRunId).toBe(runContext.actorRunId);
    expect(receipt.actorBuildId).toBe(runContext.actorBuildId);

    const result = verifyReceipt(receipt);
    expect(result).toEqual({ valid: true });
  });

  it('produces a different keypair (and signature) per run', () => {
    const first = signActionLog(sampleActionLog, runContext);
    const second = signActionLog(sampleActionLog, runContext);

    expect(first.publicKey).not.toBe(second.publicKey);
    expect(first.signature).not.toBe(second.signature);
    expect(verifyReceipt(first).valid).toBe(true);
    expect(verifyReceipt(second).valid).toBe(true);
  });

  it('verifies an empty action log', () => {
    const receipt = signActionLog([], runContext);
    expect(verifyReceipt(receipt)).toEqual({ valid: true });
  });
});
