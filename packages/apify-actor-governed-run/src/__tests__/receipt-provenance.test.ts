import { describe, expect, it } from 'vitest';
import { signActionLog } from '../receipt/sign.js';
import { verifyReceipt } from '../receipt/verify.js';
import type { ActionLogEntry, Receipt, RunContext } from '../types.js';

// Guardrail-2 blocker 1 (revealui#2198 REQUEST-CHANGES): a receipt proved
// nothing about provenance -- anyone could mint a valid one with a fresh
// keypair and a fabricated action log. The fix binds the receipt to the
// actual Apify run (actorId / actorRunId / actorBuildId) inside the signed
// payload, so a verifier can cross-check a receipt's claimed run against
// that run's own platform-attributable record (its dataset/KV store).
// Standalone `verifyReceipt` still only proves the bytes were not tampered
// with after signing -- that is documented honestly in the README now.

const actionLog: ActionLogEntry[] = [
  {
    index: 0,
    type: 'final_output',
    timestamp: '2026-07-26T00:00:00.000Z',
    detail: { output: 'done' },
  },
];

const platformRunContext: RunContext = {
  actorId: 'actor-abc123',
  actorRunId: 'run-xyz789',
  actorBuildId: 'build-def456',
};

const localRunContext: RunContext = { actorId: null, actorRunId: null, actorBuildId: null };

describe('receipt provenance binding (prove red)', () => {
  it('embeds the actor/run/build identifiers the caller supplies into the receipt', () => {
    const receipt = signActionLog(actionLog, platformRunContext);
    expect(receipt.actorId).toBe(platformRunContext.actorId);
    expect(receipt.actorRunId).toBe(platformRunContext.actorRunId);
    expect(receipt.actorBuildId).toBe(platformRunContext.actorBuildId);
  });

  it('falls back to null run-context fields for a local (non-platform) run and still verifies', () => {
    const receipt = signActionLog(actionLog, localRunContext);
    expect(receipt.actorId).toBeNull();
    expect(receipt.actorRunId).toBeNull();
    expect(receipt.actorBuildId).toBeNull();
    expect(verifyReceipt(receipt)).toEqual({ valid: true });
  });

  it('signs the run-context fields: changing actorRunId after signing invalidates the receipt', () => {
    const receipt = signActionLog(actionLog, platformRunContext);
    const forged: Receipt = { ...receipt, actorRunId: 'a-different-run-id' };
    expect(verifyReceipt(forged).valid).toBe(false);
  });

  it('signs actorId and actorBuildId too -- neither can be swapped after signing', () => {
    const receipt = signActionLog(actionLog, platformRunContext);
    expect(verifyReceipt({ ...receipt, actorId: 'someone-elses-actor' }).valid).toBe(false);
    expect(verifyReceipt({ ...receipt, actorBuildId: 'a-different-build' }).valid).toBe(false);
  });
});
