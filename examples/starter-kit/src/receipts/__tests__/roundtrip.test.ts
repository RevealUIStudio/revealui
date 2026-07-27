import { describe, expect, it } from 'vitest';
import { localRunContext } from '../run-context.js';
import { signActionLog } from '../sign.js';
import type { ActionLogEntry } from '../types.js';
import { verifyReceipt } from '../verify.js';

const sampleActionLog: ActionLogEntry[] = [
  {
    index: 0,
    type: 'tool_call',
    timestamp: '2026-07-27T00:00:00.000Z',
    detail: { toolName: 'issue_refund', params: { amountCents: 4200 }, success: true },
  },
  {
    index: 1,
    type: 'final_output',
    timestamp: '2026-07-27T00:00:01.000Z',
    detail: { output: 'done' },
  },
];

describe('signActionLog / verifyReceipt roundtrip', () => {
  it('signs an action log and verifies it as valid', () => {
    const receipt = signActionLog(sampleActionLog, localRunContext());

    expect(receipt.algorithm).toBe('ed25519');
    expect(receipt.signature).toMatch(/^v1\.ed25519\.[0-9a-f-]+\.[A-Za-z0-9_-]+$/);
    expect(receipt.publicKey).toContain('BEGIN PUBLIC KEY');

    expect(verifyReceipt(receipt)).toEqual({ valid: true });
  });

  it('rejects a receipt whose action log was modified after signing', () => {
    const receipt = signActionLog(sampleActionLog, localRunContext());
    const tampered = {
      ...receipt,
      actionLog: [{ ...receipt.actionLog[0]!, detail: { forged: true } }],
    };
    expect(verifyReceipt(tampered).valid).toBe(false);
  });

  it('rejects a receipt with an unrelated public key substituted in', () => {
    const receiptA = signActionLog(sampleActionLog, localRunContext());
    const receiptB = signActionLog(sampleActionLog, localRunContext());
    const forged = { ...receiptA, publicKey: receiptB.publicKey };
    expect(verifyReceipt(forged).valid).toBe(false);
  });

  it('rejects a structurally malformed receipt', () => {
    expect(verifyReceipt({ not: 'a receipt' }).valid).toBe(false);
    expect(verifyReceipt(null).valid).toBe(false);
  });

  it('verifies a receipt with an empty action log', () => {
    const receipt = signActionLog([], localRunContext());
    expect(verifyReceipt(receipt)).toEqual({ valid: true });
  });
});
