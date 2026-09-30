import { generateKeyPairSync, randomUUID } from 'node:crypto';
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
const app = new Hono().route('/', licenseApp);
beforeAll(async () => {
  db = await createTestDb();
  state.db = db.drizzle;
  const keys = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = keys.privateKey;
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
