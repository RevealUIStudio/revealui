// Vercel serverless function entry point.
// @hono/node-server 2.x removed the `/vercel` subpath; `getRequestListener(app.fetch)`
// is the same adapter the old `handle(app)` wrapper used (one-line thin export).
import { AsyncLocalStorage } from 'node:async_hooks';
import { getRequestListener } from '@hono/node-server';
import app from '../dist/index.js';

const honoHandler = getRequestListener(app.fetch);

// Vercel Functions put the OIDC token on x-vercel-oidc-token.
// @vercel/oidc reads Symbol.for('@vercel/request-context').headers, not a
// stored env var. The Node launcher often installs that symbol with
// waitUntil only, so this bridge adds the header for the current call.
// AsyncLocalStorage keeps overlapping Fluid invocations from sharing state.
// Do not copy the token onto process.env.
const OIDC_HEADER = 'x-vercel-oidc-token';
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');
const oidcHeaderStore = new AsyncLocalStorage();

function readOidcHeader(req) {
  const raw = req.headers?.[OIDC_HEADER];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw)) {
    return raw.find((value) => typeof value === 'string' && value.length > 0);
  }
  return undefined;
}

function attachOidcHeaderBridge() {
  const current = globalThis[REQUEST_CONTEXT];
  if (current?.__revealuiOidcBridge === true) return;

  const previousGet = typeof current?.get === 'function' ? current.get.bind(current) : undefined;
  const bridge = {
    __revealuiOidcBridge: true,
    get() {
      const base = previousGet ? (previousGet() ?? {}) : {};
      const headerToken = oidcHeaderStore.getStore();
      if (typeof headerToken !== 'string' || headerToken.length === 0) {
        return base;
      }
      const headers = { ...(base.headers ?? {}) };
      if (typeof headers[OIDC_HEADER] !== 'string' || headers[OIDC_HEADER].length === 0) {
        headers[OIDC_HEADER] = headerToken;
      }
      return { ...base, headers };
    },
  };

  try {
    Object.defineProperty(globalThis, REQUEST_CONTEXT, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: bridge,
    });
  } catch {
    // A non-configurable symbol leaves the helper on its env fallback.
  }
}

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
    return oidcHeaderStore.run(headerToken, () => invoke(req, res));
  }
  return invoke(req, res);
}
