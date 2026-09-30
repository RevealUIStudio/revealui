import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { generateLicenseKey } from '@revealui/core/license';
import { licenseJtiRevocations, licenses } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@revealui/db', async (original) => ({
  ...(await original<object>()),
  getClient: () => state.db,
}));

import licenseApp from '../license.js';

let db: TestDb;
let privateKey: string;
let publicKey: string;
const app = new Hono().route('/', licenseApp);
beforeAll(async () => {
  db = await createTestDb();
  state.db = db.drizzle;
  const keys = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = keys.privateKey;
  publicKey = keys.publicKey;
  vi.stubEnv('REVEALUI_LICENSE_PUBLIC_KEY', keys.publicKey);
  vi.stubEnv('REVEALUI_LICENSE_PUBLIC_KEY_NEXT', '');
  vi.stubEnv('REVEALUI_LICENSE_PRIVATE_KEY', keys.privateKey);
  vi.stubEnv('REVEALUI_LICENSE_SIGN_VIA_SIGNER', '');
  vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', 'self-hosted');
  vi.stubEnv('REVEALUI_ADMIN_API_KEY', 'synthetic-operator');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_synthetic');
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.close();
});
function post(path: string, body: object, admin = false) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(admin ? { 'X-Admin-API-Key': 'synthetic-operator' } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('registered hosted authority using signed tokens and real migration SQL', () => {
  it('recovers exact immutable Vault promotion evidence without signer access or prior credential', async () => {
    const customerId = randomUUID();
    const promotion = {
      kind: 'initial',
      path: `forge/customers/${customerId}/license-key`,
      expected: { kind: 'absent' },
    };
    const request = {
      operationId: randomUUID(),
      customerId,
      tier: 'pro',
      perpetual: true,
      expectedMode: 'test',
      promotion,
    };
    const recover = {
      ...request,
      recoverOnly: true,
      action: 'initial',
      promotion: { kind: promotion.kind, path: promotion.path },
    };
    expect((await post('/generate', recover)).status).toBe(401);
    const miss = await post('/generate', recover, true);
    expect(miss.status).toBe(404);
    expect(await miss.json()).toEqual({ error: 'operation_not_found' });
    const issued = await post('/generate', request, true);
    expect(issued.status).toBe(201);
    const first = await issued.json();
    expect(first.operation.grant.maxSites).toBeNull();
    expect(first.operation.effectiveGrant.maxSites).toBe(5);
    expect(first.operation.promotion).toEqual(promotion);
    const exactVaultBytes = ` ${first.licenseKey}\n`;
    const rotation = {
      ...request,
      operationId: randomUUID(),
      expectedCurrentLicenseKey: first.licenseKey,
      promotion: {
        ...promotion,
        kind: 'rotation',
        expected: {
          kind: 'sha256',
          sha256: createHash('sha256').update(exactVaultBytes).digest('hex'),
        },
      },
    };
    const rotated = await post('/generate', rotation, true);
    expect(rotated.status).toBe(201);
    const next = await rotated.json();
    expect(next.operation.expectedCurrentLicenseKeySha256).toBe(
      createHash('sha256').update(first.licenseKey).digest('hex'),
    );
    expect(next.operation.promotion.expected.sha256).not.toBe(
      next.operation.expectedCurrentLicenseKeySha256,
    );
    const recoverRotation = {
      ...recover,
      operationId: rotation.operationId,
      action: 'rotation',
      promotion: { kind: 'rotation', path: promotion.path },
    };
    vi.stubEnv('REVEALUI_LICENSE_PRIVATE_KEY', '');
    vi.stubEnv('REVEALUI_LICENSE_PUBLIC_KEY', '');
    try {
      const recovered = await post('/generate', recoverRotation, true);
      expect(recovered.status).toBe(200);
      expect(await recovered.json()).toEqual(next);
      expect((await post('/generate', recover, true)).status).toBe(409);
      expect((await post('/generate', { ...recoverRotation, tier: 'max' }, true)).status).toBe(409);
      expect(
        (await post('/generate', { ...recoverRotation, expectedMode: 'live' }, true)).status,
      ).toBe(409);
    } finally {
      vi.stubEnv('REVEALUI_LICENSE_PRIVATE_KEY', privateKey);
      vi.stubEnv('REVEALUI_LICENSE_PUBLIC_KEY', publicKey);
    }
  });
  it('contains prior credential; stale verify/refresh deny; persisted retry recovers replacement', async () => {
    const customerId = randomUUID();
    const request = { operationId: randomUUID(), customerId, tier: 'enterprise', perpetual: true };
    const first = await post('/generate', request, true);
    expect(first.status).toBe(201);
    const oldKey = (await first.json()).licenseKey as string;
    expect(
      (await (await post('/verify', { licenseKey: oldKey, requireRegistration: true })).json())
        .valid,
    ).toBe(true);
    const rotation = { ...request, operationId: randomUUID(), expectedCurrentLicenseKey: oldKey };
    const rotated = await post('/generate', rotation, true);
    expect(rotated.status).toBe(201);
    const nextKey = (await rotated.json()).licenseKey as string;
    expect(nextKey).not.toBe(oldKey);
    expect(
      (await (await post('/verify', { licenseKey: oldKey, requireRegistration: true })).json())
        .valid,
    ).toBe(false);
    expect((await post('/refresh', { licenseKey: oldKey, customerId })).status).toBe(403);
    expect(
      (await (await post('/verify', { licenseKey: nextKey, requireRegistration: true })).json())
        .valid,
    ).toBe(true);
    vi.stubEnv('REVEALUI_LICENSE_PRIVATE_KEY', '');
    expect((await (await post('/generate', rotation, true)).json()).licenseKey).toBe(nextKey);
    vi.stubEnv('REVEALUI_LICENSE_PRIVATE_KEY', privateKey);
    const claims = JSON.parse(
      Buffer.from(nextKey.split('.')[1] as string, 'base64url').toString('utf8'),
    );
    await db.drizzle.insert(licenseJtiRevocations).values({ jti: claims.jti, customerId });
    expect((await post('/generate', rotation, true)).status).toBe(409);
  });
  it('never delivers a live credential to a test credential for the same customer', async () => {
    const customerId = randomUUID();
    const issue = async () => {
      const response = await post(
        '/generate',
        { operationId: randomUUID(), tier: 'pro', customerId },
        true,
      );
      expect(response.status).toBe(201);
      return (await response.json()).licenseKey as string;
    };
    const testKey = await issue();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_synthetic');
    vi.stubEnv('STRIPE_LIVE_MODE', 'true');
    try {
      const liveKey = await issue();
      expect((await post('/refresh', { licenseKey: testKey, customerId })).status).toBe(403);
      expect(
        (await (await post('/refresh', { licenseKey: liveKey, customerId })).json()).licenseKey,
      ).toBe(liveKey);
      const unregistered = await generateLicenseKey({ tier: 'pro', customerId }, privateKey);
      expect((await post('/refresh', { licenseKey: unregistered, customerId })).status).toBe(403);
    } finally {
      vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_synthetic');
      vi.stubEnv('STRIPE_LIVE_MODE', 'false');
    }
  });
  it('denies unregistered, deleted and other-mode exact signed credentials', async () => {
    const customerId = randomUUID();
    const key = await generateLicenseKey({ tier: 'pro', customerId }, privateKey);
    const verify = () => post('/verify', { licenseKey: key, requireRegistration: true });
    expect((await (await verify()).json()).valid).toBe(false);
    const id = randomUUID();
    await db.drizzle
      .insert(licenses)
      .values({ id, customerId, licenseKey: key, tier: 'pro', mode: 'live' });
    // Fixture API is test-mode; exact token evidence in live cannot authorize it.
    expect((await (await verify()).json()).valid).toBe(false);
    await db.drizzle.update(licenses).set({ mode: 'test' }).where(eq(licenses.id, id));
    expect((await (await verify()).json()).valid).toBe(true);
    await db.drizzle.update(licenses).set({ deletedAt: new Date() }).where(eq(licenses.id, id));
    expect((await (await verify()).json()).valid).toBe(false);
  });
});
