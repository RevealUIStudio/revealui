// Vercel serverless function entry point.
// @hono/node-server 2.x removed the `/vercel` subpath; `getRequestListener(app.fetch)`
// is the same adapter the old `handle(app)` wrapper used (one-line thin export).
import { getRequestListener } from '@hono/node-server';
import app from '../dist/index.js';
import {
  attachOidcHeaderBridge,
  readOidcHeader,
  runWithOidcHeader,
} from './request-context-bridge.js';

const honoHandler = getRequestListener(app.fetch);

// Vercel Functions put the OIDC token on x-vercel-oidc-token.
// @vercel/oidc reads Symbol.for('@vercel/request-context').headers, not a
// stored env var. The Node launcher often installs that symbol with
// waitUntil only. The bridge adds the header for the current call and
// keeps waitUntil plus any other properties already on the context.
// AsyncLocalStorage keeps overlapping Fluid invocations from sharing state.
// Do not copy the token onto process.env.
attachOidcHeaderBridge();

/**
 * Pre-buffer the request body before passing to the Hono adapter.
 *
 * `getRequestListener` checks `incoming.rawBody` first. If it's a Buffer,
 * the adapter wraps it in a ReadableStream and never touches the underlying
 * Node.js stream. Without this step, `Readable.toWeb(incoming)` produces a
 * stream that hangs in Vercel's serverless environment because the runtime
 * puts the IncomingMessage stream in a state where it never emits "end".
 */
async function invoke(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !req.rawBody) {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    req.rawBody = Buffer.concat(chunks);
  }
  return honoHandler(req, res);
}

export default async function handler(req, res) {
  attachOidcHeaderBridge();
  const headerToken = readOidcHeader(req);
  if (headerToken) {
    return runWithOidcHeader(headerToken, () => invoke(req, res));
  }
  return invoke(req, res);
}
