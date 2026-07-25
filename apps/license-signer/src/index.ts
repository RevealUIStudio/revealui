/**
 * license-signer process entry (GAP-260 P4-2).
 *
 * Env:
 *   REVEALUI_LICENSE_PRIVATE_KEY   — required PKCS#8 Ed25519 PEM
 *   REVEALUI_LICENSE_PUBLIC_KEY    — optional; enables kid on JWT header
 *   REVEALUI_SIGNER_INVOKE_SECRET  — required HMAC secret (no REVEALUI_SECRET fallback)
 *   PORT                           — default 8791
 */

import { serve } from '@hono/node-server';
import { createLicenseSignerApp } from './app.js';
import { getInvokeSecret } from './auth.js';
import { getSigningPrivateKey } from './mint.js';

function boot(): void {
  // Fail loud at process start so a misconfigured deploy never binds a port.
  getInvokeSecret(process.env);
  getSigningPrivateKey(process.env);

  const port = Number(process.env.PORT ?? '8791');
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  const app = createLicenseSignerApp(process.env);
  serve({ fetch: app.fetch, port }, (info) => {
    process.stdout.write(`license-signer listening on :${info.port}\n`);
  });
}

boot();
