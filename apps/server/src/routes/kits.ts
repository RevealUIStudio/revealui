/**
 * Agency Founding Kit download (GAP-448 Phase 2).
 *
 * GET /api/kits/agency-founding/download?token=…
 * Token is HMAC-signed short TTL; no session required when the token is valid.
 *
 * P2-A thin: text multi-file body from jsonb artifact.
 * P2-B full: redirect to R2 public URL when artifact_uri is set; else text fallback.
 */

import { getClient } from '@revealui/db';
import { kitFulfillments } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { verifyKitDownloadToken } from '../lib/kit-download-token.js';
import { serializeKitArtifactForDownload } from '../lib/kit-stamp-artifact.js';

const app = new OpenAPIHono();

const downloadRoute = createRoute({
  method: 'get',
  path: '/agency-founding/download',
  tags: ['Kits'],
  summary: 'Download Agency Founding Kit package (signed token)',
  request: {
    query: z.object({
      token: z.string().min(1).openapi({ description: 'Signed download token' }),
    }),
  },
  responses: {
    200: {
      description: 'Kit package (text multi-file or redirected tarball)',
      content: {
        'text/plain': {
          schema: z.string(),
        },
      },
    },
    302: { description: 'Redirect to object-storage tarball (full mode)' },
    400: { description: 'Missing or invalid token' },
    404: { description: 'Fulfillment not ready' },
    410: { description: 'Token expired' },
  },
});

app.openapi(downloadRoute, async (c) => {
  const { token } = c.req.valid('query');
  const verified = verifyKitDownloadToken(token);
  if (!verified.ok) {
    if (verified.reason === 'expired') {
      throw new HTTPException(410, { message: 'Download link expired' });
    }
    throw new HTTPException(400, { message: 'Invalid download token' });
  }

  const db = getClient();
  const [row] = await db
    .select()
    .from(kitFulfillments)
    .where(eq(kitFulfillments.id, verified.fulfillmentId))
    .limit(1);

  if (row?.status !== 'ready') {
    throw new HTTPException(404, { message: 'Kit package not available' });
  }

  // P2-B full: signed token gates redirect to unguessable object URL
  const uri = row.artifactUri?.trim();
  if (uri && (uri.startsWith('https://') || uri.startsWith('http://'))) {
    return c.redirect(uri, 302);
  }

  if (!row.artifact) {
    throw new HTTPException(404, { message: 'Kit package not available' });
  }

  const body = serializeKitArtifactForDownload(row.artifact);
  const filename = `agency-founding-kit-${row.branding.slug || 'package'}.txt`;
  return c.text(body, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
});

export default app;
