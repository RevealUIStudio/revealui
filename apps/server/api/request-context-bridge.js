// Request-context bridge for the Vercel Node entry.
// @vercel/oidc reads Symbol.for('@vercel/request-context').headers.
// The Node launcher often installs that symbol with waitUntil only.
// This bridge adds the OIDC header for the current call and keeps
// waitUntil plus any other properties already on the context.
// AsyncLocalStorage keeps overlapping Fluid invocations from sharing state.
// Do not copy the token onto process.env.
import { AsyncLocalStorage } from 'node:async_hooks';

export const OIDC_HEADER = 'x-vercel-oidc-token';
export const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

const oidcHeaderStore = new AsyncLocalStorage();

export function readOidcHeader(req) {
  const raw = req.headers?.[OIDC_HEADER];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw)) {
    return raw.find((value) => typeof value === 'string' && value.length > 0);
  }
  return undefined;
}

function isContextRecord(value) {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function shouldSkipCopiedKey(key) {
  return key === 'get' || key === 'constructor' || key === '__revealuiOidcBridge';
}

function copyProperty(bridge, owner, key, descriptor) {
  try {
    if ('value' in descriptor && typeof descriptor.value === 'function') {
      Object.defineProperty(bridge, key, {
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
        value: descriptor.value.bind(owner),
      });
      return;
    }
    Object.defineProperty(bridge, key, descriptor);
  } catch {
    // A property that cannot be copied stays off the bridge.
  }
}

function preserveContextProperties(bridge, current) {
  if (!isContextRecord(current)) return;

  const seen = new Set();
  let source = current;
  while (isContextRecord(source) && source !== Object.prototype && source !== Function.prototype) {
    for (const key of Reflect.ownKeys(source)) {
      if (shouldSkipCopiedKey(key) || seen.has(key)) continue;
      seen.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!descriptor) continue;
      copyProperty(bridge, current, key, descriptor);
    }
    source = Object.getPrototypeOf(source);
  }
}

export function attachOidcHeaderBridge() {
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

  preserveContextProperties(bridge, current);

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

export function runWithOidcHeader(headerToken, fn) {
  if (typeof headerToken === 'string' && headerToken.length > 0) {
    return oidcHeaderStore.run(headerToken, fn);
  }
  return fn();
}
