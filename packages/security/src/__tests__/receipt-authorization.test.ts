import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type ReceiptAuthorizationRequest,
  signReceiptAuthorization,
  verifyReceiptAuthorization,
} from '../review-receipt.js';

const pair = generateKeyPairSync('ed25519');
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustedKeys = { fixture: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
const now = new Date('2026-10-22T15:00:00.000Z');
const request: ReceiptAuthorizationRequest = {
  schema: 'revealfleet-receipt-authorization-request/v1',
  challenge: 'a'.repeat(64),
  repositoryId: 300,
  pullRequest: 7,
  envelopeSha256: 'b'.repeat(64),
};
const signed = () =>
  signReceiptAuthorization({
    request,
    generation: 3,
    authorized: true,
    keyId: 'fixture',
    privateKey,
    now,
    receiptExpiresAt: new Date(now.getTime() + 60_000),
  });

describe('online receipt authorization signatures', () => {
  it('binds the current generation to the nonce and exact immutable receipt digest', () => {
    expect(
      verifyReceiptAuthorization({
        envelope: signed(),
        expected: request,
        trustedKeys,
        now,
        requestedAt: now,
      }),
    ).toEqual({ ok: true, generation: 3 });
  });
  it('rejects replay, another receipt digest, revoked keys, and edited generations', () => {
    const envelope = signed();
    for (const expected of [
      { ...request, challenge: 'c'.repeat(64) },
      { ...request, envelopeSha256: 'c'.repeat(64) },
    ])
      expect(
        verifyReceiptAuthorization({ envelope, expected, trustedKeys, now, requestedAt: now }).ok,
      ).toBe(false);
    expect(
      verifyReceiptAuthorization({
        envelope,
        expected: request,
        trustedKeys: {},
        now,
        requestedAt: now,
      }).ok,
    ).toBe(false);
    expect(
      verifyReceiptAuthorization({
        envelope: { ...envelope, authorization: { ...envelope.authorization, generation: 4 } },
        expected: request,
        trustedKeys,
        now,
        requestedAt: now,
      }).ok,
    ).toBe(false);
  });
  it('rejects late responses and caps authorization at receipt expiry', () => {
    const envelope = signReceiptAuthorization({
      request,
      generation: 3,
      authorized: true,
      keyId: 'fixture',
      privateKey,
      now,
      receiptExpiresAt: new Date(now.getTime() + 1000),
    });
    expect(envelope.authorization.expiresAt).toBe('2026-10-22T15:00:01.000Z');
    expect(
      verifyReceiptAuthorization({
        envelope,
        expected: request,
        trustedKeys,
        now: new Date(now.getTime() + 1000),
        requestedAt: now,
      }).ok,
    ).toBe(false);
  });
});
