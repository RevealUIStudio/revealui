import { generateKeyPairSync } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import {
  type ReceiptAuthorizationRequest,
  verifyReceiptAuthorization,
} from '@revealui/security/review-receipt';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './__tests__/database.js';
import { PostgresReceiptAuthority } from './receipt-authority.js';

const pair = generateKeyPairSync('ed25519');
const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustedKeys = { fixture: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
const request: ReceiptAuthorizationRequest = {
  schema: 'revealfleet-receipt-authorization-request/v1',
  challenge: 'b'.repeat(64),
  repositoryId: 300,
  pullRequest: 7,
  envelopeSha256: 'a'.repeat(64),
};

describe('durable receipt authorization generations', () => {
  let client: PGlite;
  let store: Awaited<ReturnType<typeof createTestDatabase>>;
  let authority: PostgresReceiptAuthority;
  let expiry: Date;

  beforeEach(async () => {
    store = await createTestDatabase();
    client = store.client;
    authority = new PostgresReceiptAuthority(store.db);
    expiry = new Date(Date.now() + 60_000);
    // Synthetic immutable row exercises DB custody/CAS, not receipt cryptography.
    await store.db.execute(sql`INSERT INTO review_controller_signed_receipts
      (receipt_id, repository_id, pull_request, head_sha, base_sha, candidate_tree_sha,
       policy_version, key_id, envelope_sha256, canonical_envelope, issued_at, expires_at)
      VALUES ('fixture-receipt', 300, 7, repeat('a',40), repeat('b',40), repeat('c',40),
       'fixture-policy', 'fixture', ${request.envelopeSha256}, '{}', now(), ${expiry})`);
  });
  afterEach(async () => {
    await client?.close();
  });

  async function approve(generation: number) {
    return authority.approve({
      repositoryId: 300,
      pullRequest: 7,
      generation,
      receiptId: 'fixture-receipt',
      envelopeSha256: request.envelopeSha256,
      expiresAt: expiry,
    });
  }
  async function current() {
    const now = new Date();
    const envelope = await authority.attest({ request, keyId: 'fixture', privateKey, now });
    return verifyReceiptAuthorization({
      envelope,
      expected: request,
      trustedKeys,
      requestedAt: now,
      now,
    });
  }

  it('authorizes only a current pending generation with an exact stored receipt', async () => {
    const generation = await authority.begin(300, 7);
    expect((await current()).ok).toBe(false);
    expect(await approve(generation)).toBe(true);
    expect(await current()).toEqual({ ok: true, generation });
    expect(await approve(generation)).toBe(false);
  });

  it('rejects a stale writer and a delayed successful check after a newer durable revocation', async () => {
    const first = await authority.begin(300, 7);
    expect(await approve(first)).toBe(true);
    const second = await authority.begin(300, 7);
    expect(second).toBeGreaterThan(first);
    expect(await authority.revoke(300, 7, second)).toBe(true);
    expect(await approve(first)).toBe(false);
    // Whether a delayed GitHub PATCH now says success cannot change this result.
    expect((await current()).ok).toBe(false);
  });

  it('rejects backward generations in the database itself', async () => {
    await authority.begin(300, 7);
    await authority.begin(300, 7);
    await expect(
      store.db.execute(
        sql`UPDATE review_controller_receipt_authorizations SET generation = 1 WHERE repository_id = 300 AND pull_request = 7`,
      ),
    ).rejects.toMatchObject({
      cause: { code: 'P0001', message: 'receipt_authorization_generation_not_monotonic' },
    });
  });

  it('refuses authorization when the signed receipt digest does not match custody', async () => {
    const generation = await authority.begin(300, 7);
    expect(
      await authority.approve({
        repositoryId: 300,
        pullRequest: 7,
        generation,
        receiptId: 'fixture-receipt',
        envelopeSha256: 'f'.repeat(64),
        expiresAt: expiry,
      }),
    ).toBe(false);
    expect((await current()).ok).toBe(false);
  });
});
