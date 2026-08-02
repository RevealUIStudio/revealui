/**
 * Request AsyncLocalStorage (ADR D10 / T6).
 * Edge-safe: uses `async_hooks` AsyncLocalStorage (supported on Node 24,
 * Cloudflare Workers, Vercel Edge, Deno, Bun per D18.b). No fs/path/Buffer.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const requestStorage = new AsyncLocalStorage<Request>();

/** Run `fn` with `request` bound for `getRequest()`. */
export function runWithRequest<T>(request: Request, fn: () => T): T {
  return requestStorage.run(request, fn);
}

/** Run async work with `request` bound. */
export function runWithRequestAsync<T>(request: Request, fn: () => Promise<T>): Promise<T> {
  return requestStorage.run(request, fn);
}

/**
 * Active request for the current async context (server actions / loaders).
 * Throws if called outside `runWithRequest` / `renderRequest`.
 */
export function getRequest(): Request {
  const req = requestStorage.getStore();
  if (!req) {
    throw new Error(
      'getRequest() called outside a request context. Use renderRequest or runWithRequest.',
    );
  }
  return req;
}

/** Soft variant for optional request access. */
export function getRequestOrNull(): Request | null {
  return requestStorage.getStore() ?? null;
}
