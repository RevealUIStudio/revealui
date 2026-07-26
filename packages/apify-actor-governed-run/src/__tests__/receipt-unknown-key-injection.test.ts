import { describe, expect, it } from 'vitest';
import { signActionLog } from '../receipt/sign.js';
import { verifyReceipt } from '../receipt/verify.js';
import type { RunContext } from '../types.js';

// Guardrail-2 blocker 2 (revealui#2198 REQUEST-CHANGES): ActionLogEntrySchema
// and ReceiptSchema were non-strict `z.object`s, so Zod silently stripped
// unknown keys during `safeParse`. verify.ts canonicalized the parsed
// (post-strip) data, but every consumer reads the caller's original,
// pre-strip `receipt`/`actionLog` object -- so an injected field survived
// into what a consumer renders while the signature never covered it, and
// `verifyReceipt` still reported `{ valid: true }`. Making both schemas
// `.strict()` makes verification reject any receipt carrying a field the
// signature does not cover, instead of silently ignoring it.

const runContext: RunContext = { actorId: 'a', actorRunId: 'r', actorBuildId: 'b' };

describe('verifyReceipt rejects unknown-key injection (prove red)', () => {
  it('rejects a receipt with a field injected onto a signed action log entry', () => {
    const receipt = signActionLog(
      [
        {
          index: 0,
          type: 'model_call',
          timestamp: '2026-07-26T00:00:00.000Z',
          detail: { content: 'the real answer' },
        },
      ],
      runContext,
    );

    const withInjectedField = {
      ...receipt,
      actionLog: [
        {
          ...receipt.actionLog[0],
          attackerField: 'a field the signature never covered',
        },
      ],
    };

    expect(verifyReceipt(withInjectedField).valid).toBe(false);
  });

  it('rejects a receipt with an unknown top-level field injected', () => {
    const receipt = signActionLog(
      [{ index: 0, type: 'final_output', timestamp: '2026-07-26T00:00:00.000Z', detail: {} }],
      runContext,
    );

    const withInjectedField = { ...receipt, unexpectedField: 'also never signed' };
    expect(verifyReceipt(withInjectedField).valid).toBe(false);
  });
});
