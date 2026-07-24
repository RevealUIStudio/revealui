/**
 * Hono app for the license-signer service (GAP-260 P4-2).
 */

import { Hono } from 'hono';
import {
  getInvokeSecret,
  SIGNER_SIGNATURE_HEADER,
  SIGNER_TIMESTAMP_HEADER,
  verifyMintRequest,
} from './auth.js';
import {
  getSigningPrivateKey,
  getSigningPublicKey,
  mintLicenseKey,
  mintRequestSchema,
} from './mint.js';

export function createLicenseSignerApp(env: NodeJS.ProcessEnv = process.env): Hono {
  const app = new Hono();

  app.get('/health/live', (c) => c.json({ ok: true, service: 'license-signer' }));

  app.post('/internal/mint', async (c) => {
    let secret: string;
    try {
      secret = getInvokeSecret(env);
    } catch {
      return c.json({ error: 'signer_misconfigured' }, 503);
    }

    let privateKey: string;
    try {
      privateKey = getSigningPrivateKey(env);
    } catch {
      return c.json({ error: 'signer_misconfigured' }, 503);
    }

    const bodyText = await c.req.text();
    const path = new URL(c.req.url).pathname;
    const auth = verifyMintRequest({
      secret,
      method: c.req.method,
      path,
      body: bodyText,
      timestampHeader: c.req.header(SIGNER_TIMESTAMP_HEADER),
      signatureHeader: c.req.header(SIGNER_SIGNATURE_HEADER),
    });
    if (!auth.ok) {
      return c.json({ error: 'unauthorized', reason: auth.reason }, 401);
    }

    let json: unknown;
    try {
      json = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    const parsed = mintRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
    }

    try {
      const publicKey = getSigningPublicKey(env);
      const licenseKey = await mintLicenseKey(parsed.data, privateKey, publicKey);
      return c.json({ licenseKey });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'mint_failed', message }, 500);
    }
  });

  return app;
}
