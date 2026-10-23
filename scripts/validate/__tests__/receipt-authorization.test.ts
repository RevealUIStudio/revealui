import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signReceiptAuthorization } from '../../../packages/security/src/review-receipt.js';

const {
  verifyCurrentReceiptAuthorization,
  decideReceiptAdmission,
} = require('../security-review-gate.cjs');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustedKeys = { fixture: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
const result = {
  status: 'verified',
  receiptId: 'receipt-fixture',
  receiptExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  repositoryId: 300,
  pullRequest: 7,
  envelopeSha256: 'a'.repeat(64),
};
const ownerDecision = { action: 'hold', kind: 'no-owner-signature' };

describe('base-trusted online receipt authorization', () => {
  it('rejects delayed external success after the authoritative generation is revoked', async () => {
    const now = new Date();
    let generation = 1;
    let authorized = true;
    let check = 'failure';
    let delayedSuccess = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      delayedSuccess = () => {
        check = 'success';
        resolve();
      };
    });
    // A loses its DB session; B advances the durable generation and revokes.
    generation = 2;
    authorized = false;
    check = 'failure';
    delayedSuccess();
    await firstWrite;
    expect(check).toBe('success');
    const receiptResult = await verifyCurrentReceiptAuthorization({
      result,
      config: { authorityUrl: 'https://controller.example/receipt/authorization', trustedKeys },
      now: () => now,
      challenge: () => 'b'.repeat(64),
      fetchImpl: async (_url: string, init: RequestInit) =>
        new Response(
          JSON.stringify(
            signReceiptAuthorization({
              request: JSON.parse(String(init.body)),
              generation,
              authorized,
              keyId: 'fixture',
              privateKey: privatePem,
              now,
            }),
          ),
        ),
    });
    expect(receiptResult.status).toBe('ineligible');
    expect(decideReceiptAdmission({ mode: 'enforce', receiptResult, ownerDecision }).action).toBe(
      'hold',
    );
  });

  it('accepts only the exact challenged receipt from a trusted current generation', async () => {
    const now = new Date();
    const run = (override: Record<string, unknown> = {}) =>
      verifyCurrentReceiptAuthorization({
        result,
        config: { authorityUrl: 'https://controller.example/receipt/authorization', trustedKeys },
        now: () => now,
        challenge: () => 'b'.repeat(64),
        fetchImpl: async (_url: string, init: RequestInit) =>
          new Response(
            JSON.stringify(
              signReceiptAuthorization({
                request: JSON.parse(String(init.body)),
                generation: 3,
                authorized: true,
                keyId: 'fixture',
                privateKey: privatePem,
                now,
                receiptExpiresAt: new Date(now.getTime() + 60_000),
              }),
            ),
          ),
        ...override,
      });
    const current = await run();
    expect(current).toMatchObject({ authorizationVerified: true, generation: 3 });
    expect(
      decideReceiptAdmission({
        mode: 'enforce',
        receiptResult: current,
        ownerDecision,
        trustedKeys,
        now,
      }).action,
    ).toBe('clear');
    expect(
      (
        await run({
          config: {
            authorityUrl: 'https://controller.example/receipt/authorization',
            trustedKeys: {},
          },
        })
      ).status,
    ).toBe('ineligible');
    expect(
      (
        await run({
          fetchImpl: async () => {
            throw new Error('unavailable');
          },
        })
      ).status,
    ).toBe('ineligible');
    expect(
      (
        await run({
          config: { authorityUrl: 'http://controller.example/receipt/authorization', trustedKeys },
        })
      ).status,
    ).toBe('ineligible');
  });

  it('rejects replayed challenge responses, oversized responses and signature-only clearance', async () => {
    const now = new Date();
    const request = {
      schema: 'revealfleet-receipt-authorization-request/v1' as const,
      challenge: 'c'.repeat(64),
      repositoryId: 300,
      pullRequest: 7,
      envelopeSha256: result.envelopeSha256,
    };
    const replay = signReceiptAuthorization({
      request,
      generation: 3,
      authorized: true,
      keyId: 'fixture',
      privateKey: privatePem,
      now,
      receiptExpiresAt: new Date(now.getTime() + 60_000),
    });
    const input = {
      result,
      config: { authorityUrl: 'https://controller.example/receipt/authorization', trustedKeys },
      now: () => now,
      challenge: () => 'b'.repeat(64),
    };
    expect(
      (
        await verifyCurrentReceiptAuthorization({
          ...input,
          fetchImpl: async () => new Response(JSON.stringify(replay)),
        })
      ).status,
    ).toBe('ineligible');
    expect(
      (
        await verifyCurrentReceiptAuthorization({
          ...input,
          fetchImpl: async () => new Response('x'.repeat(20_000)),
        })
      ).status,
    ).toBe('ineligible');
    expect(
      decideReceiptAdmission({ mode: 'enforce', receiptResult: result, ownerDecision }).action,
    ).toBe('hold');
  });

  it.each([
    { deadline: 'proof', receiptLifetime: 60_000, readDuration: 5_001 },
    { deadline: 'receipt', receiptLifetime: 1_000, readDuration: 1_001 },
  ])(
    'holds when the $deadline expires during the final GitHub read',
    async ({ receiptLifetime, readDuration }) => {
      const requestedAt = new Date();
      let clock = requestedAt;
      const receiptExpiresAt = new Date(requestedAt.getTime() + receiptLifetime);
      const receiptResult = await verifyCurrentReceiptAuthorization({
        result: { ...result, receiptExpiresAt: receiptExpiresAt.toISOString() },
        config: { authorityUrl: 'https://controller.example/receipt/authorization', trustedKeys },
        now: () => clock,
        challenge: () => 'b'.repeat(64),
        fetchImpl: async (_url: string, init: RequestInit) =>
          new Response(
            JSON.stringify(
              signReceiptAuthorization({
                request: JSON.parse(String(init.body)),
                generation: 3,
                authorized: true,
                keyId: 'fixture',
                privateKey: privatePem,
                now: clock,
                receiptExpiresAt,
              }),
            ),
          ),
      });
      expect(receiptResult.authorizationVerified).toBe(true);
      expect(
        decideReceiptAdmission({
          mode: 'enforce',
          receiptResult,
          ownerDecision,
          trustedKeys,
          now: clock,
        }).action,
      ).toBe('clear');
      const candidate = { head: 'head', base: 'base', merge: 'merge' };
      const finalGitHubRead = async () => {
        clock = new Date(requestedAt.getTime() + readDuration);
        return { ...candidate };
      };
      expect(await finalGitHubRead()).toEqual(candidate);
      expect(
        decideReceiptAdmission({
          mode: 'enforce',
          receiptResult,
          ownerDecision,
          trustedKeys,
          now: clock,
        }).action,
      ).toBe('hold');
    },
  );
});
