/**
 * Audit public-key endpoint (GAP-355 Stage 3, spec D4).
 *
 * `GET /api/audit/public-key` — unauthenticated, returns the deployment's
 * Ed25519 SPKI public key + kid + alg so anyone can verify an audit-log receipt
 * OFFLINE, without calling us with a secret (ADR §2a: verification is never for
 * sale). The key is resolved from `REVEALUI_AUDIT_PUBLIC_KEY`, else derived from
 * `REVEALUI_AUDIT_SIGNING_KEY`. An unsigned deployment (neither key configured)
 * answers an honest 404, never a 500.
 */

import { resolveAuditPublicKey } from '@revealui/core/security';
import { OpenAPIHono } from '@revealui/openapi';

const app = new OpenAPIHono();

app.get('/public-key', (c) => {
  const resolved = resolveAuditPublicKey(process.env);
  if (!resolved) {
    return c.json(
      {
        error:
          'Audit signing is not configured on this deployment. No public key to publish. ' +
          'Rows written here are unsigned; see docs/SECRETS.md to enable per-row signing.',
      },
      404,
    );
  }
  // Public, credential-free, cacheable — safe behind a shared CDN variant.
  c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return c.json({ alg: resolved.alg, kid: resolved.kid, publicKeyPem: resolved.publicKeyPem }, 200);
});

export default app;
