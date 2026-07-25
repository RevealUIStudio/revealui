import { generateKeyPairSync } from 'node:crypto';
import { validateLicenseKey } from '@revealui/core/license';
import { beforeAll, describe, expect, it } from 'vitest';
import { createLicenseSignerApp } from './app.js';
import { signMintRequest } from './auth.js';

const INVOKE_SECRET = 'unit-test-signer-invoke-secret';
const PATH = '/internal/mint';

let privateKeyPem: string;
let publicKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
});

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    REVEALUI_SIGNER_INVOKE_SECRET: INVOKE_SECRET,
    REVEALUI_LICENSE_PRIVATE_KEY: privateKeyPem,
    REVEALUI_LICENSE_PUBLIC_KEY: publicKeyPem,
    ...overrides,
  };
}

async function signedMint(
  app: ReturnType<typeof createLicenseSignerApp>,
  body: string,
  opts?: { secret?: string; ts?: number; skipSig?: boolean },
): Promise<Response> {
  const ts = opts?.ts ?? Math.floor(Date.now() / 1000);
  const secret = opts?.secret ?? INVOKE_SECRET;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (!opts?.skipSig) {
    headers['x-revealui-signer-timestamp'] = String(ts);
    headers['x-revealui-signer-signature'] = signMintRequest(secret, 'POST', PATH, body, ts);
  }
  return app.request(PATH, { method: 'POST', headers, body });
}

describe('createLicenseSignerApp', () => {
  it('GET /health/live is unauthenticated', async () => {
    const app = createLicenseSignerApp(env());
    const res = await app.request('/health/live');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, service: 'license-signer' });
  });

  it('POST /internal/mint returns 401 without HMAC headers', async () => {
    const app = createLicenseSignerApp(env());
    const res = await signedMint(app, '{"tier":"pro","customerId":"cus_a"}', { skipSig: true });
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(json.error).toBe('unauthorized');
    expect(json.reason).toBe('missing_headers');
  });

  it('POST /internal/mint returns 401 for bad signature', async () => {
    const app = createLicenseSignerApp(env());
    const res = await signedMint(app, '{"tier":"pro","customerId":"cus_a"}', {
      secret: 'wrong-secret',
    });
    expect(res.status).toBe(401);
  });

  it('POST /internal/mint returns 503 when invoke secret missing', async () => {
    const app = createLicenseSignerApp({
      REVEALUI_LICENSE_PRIVATE_KEY: privateKeyPem,
    });
    const res = await app.request(PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'signer_misconfigured' });
  });

  it('POST /internal/mint returns 503 when private key missing', async () => {
    const app = createLicenseSignerApp({
      REVEALUI_SIGNER_INVOKE_SECRET: INVOKE_SECRET,
    });
    const res = await signedMint(app, '{"tier":"pro","customerId":"cus_a"}');
    expect(res.status).toBe(503);
  });

  it('POST /internal/mint returns 400 for invalid body', async () => {
    const app = createLicenseSignerApp(env());
    const res = await signedMint(app, '{"tier":"free","customerId":"cus_a"}');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('invalid_body');
  });

  it('POST /internal/mint mints a JWT via generateLicenseKey', async () => {
    const app = createLicenseSignerApp(env());
    const body = JSON.stringify({ tier: 'pro', customerId: 'cus_mint_1' });
    const res = await signedMint(app, body);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { licenseKey: string };
    expect(typeof json.licenseKey).toBe('string');
    expect(json.licenseKey.split('.')).toHaveLength(3);

    const payload = await validateLicenseKey(json.licenseKey, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('pro');
    expect(payload?.customerId).toBe('cus_mint_1');
    expect(typeof payload?.jti).toBe('string');
  });

  it('does not fall back to REVEALUI_SECRET for invoke auth', async () => {
    const app = createLicenseSignerApp({
      REVEALUI_SECRET: 'session-only',
      REVEALUI_LICENSE_PRIVATE_KEY: privateKeyPem,
      // no REVEALUI_SIGNER_INVOKE_SECRET
    });
    const body = JSON.stringify({ tier: 'pro', customerId: 'cus_x' });
    // Sign with REVEALUI_SECRET as if someone tried the wrong secret
    const ts = Math.floor(Date.now() / 1000);
    const res = await app.request(PATH, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revealui-signer-timestamp': String(ts),
        'x-revealui-signer-signature': signMintRequest('session-only', 'POST', PATH, body, ts),
      },
      body,
    });
    // Misconfigured: missing dedicated invoke secret → 503, not 401 from REVEALUI_SECRET
    expect(res.status).toBe(503);
  });
});
