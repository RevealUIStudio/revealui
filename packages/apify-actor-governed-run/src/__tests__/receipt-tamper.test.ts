import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signActionLog } from '../receipt/sign.js';
import { verifyReceipt } from '../receipt/verify.js';
import type { ActionLogEntry, Receipt } from '../types.js';

const baseActionLog: ActionLogEntry[] = [
  {
    index: 0,
    type: 'model_call',
    timestamp: '2026-07-26T00:00:00.000Z',
    detail: { content: 'the original answer' },
  },
];

describe('verifyReceipt rejects tampered receipts (prove red)', () => {
  it('rejects a receipt whose action log was modified after signing', () => {
    const receipt = signActionLog(baseActionLog);

    const tampered: Receipt = {
      ...receipt,
      actionLog: [{ ...receipt.actionLog[0]!, detail: { content: 'a forged answer' } }],
    };

    const result = verifyReceipt(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects a receipt whose timestamp was modified after signing', () => {
    const receipt = signActionLog(baseActionLog);
    const tampered: Receipt = { ...receipt, timestamp: '2099-01-01T00:00:00.000Z' };

    expect(verifyReceipt(tampered).valid).toBe(false);
  });

  it('rejects a receipt with a substituted signature from a different keypair', () => {
    const receiptA = signActionLog(baseActionLog);
    const receiptB = signActionLog(baseActionLog);

    const forged: Receipt = { ...receiptA, signature: receiptB.signature };
    expect(verifyReceipt(forged).valid).toBe(false);
  });

  it('rejects a receipt whose public key does not match the signature kid', () => {
    const receipt = signActionLog(baseActionLog);
    const { publicKey: unrelatedPublicKey } = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    const forged: Receipt = { ...receipt, publicKey: unrelatedPublicKey };
    const result = verifyReceipt(forged);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/key id/);
  });

  it('rejects a structurally malformed receipt', () => {
    expect(verifyReceipt({ not: 'a receipt' }).valid).toBe(false);
    expect(verifyReceipt(null).valid).toBe(false);
    expect(verifyReceipt(undefined).valid).toBe(false);
  });

  it('rejects an unrecognized signature format', () => {
    const receipt = signActionLog(baseActionLog);
    const forged: Receipt = { ...receipt, signature: 'not-a-real-signature' };
    expect(verifyReceipt(forged).valid).toBe(false);
  });
});
