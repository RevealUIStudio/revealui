import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  attachOidcHeaderBridge,
  OIDC_HEADER,
  REQUEST_CONTEXT,
  readOidcHeader,
  runWithOidcHeader,
} from './request-context-bridge.js';

interface BridgedContext {
  __revealuiOidcBridge?: boolean;
  waitUntil: (promise: Promise<unknown>) => void;
  region?: string;
  marker?: string;
  get: () => { headers?: Record<string, string>; waitUntil?: unknown };
}

function installContext(value: unknown): void {
  Object.defineProperty(globalThis, REQUEST_CONTEXT, {
    configurable: true,
    enumerable: false,
    writable: true,
    value,
  });
}

function bridgedContext(): BridgedContext {
  return globalThis[REQUEST_CONTEXT] as BridgedContext;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, REQUEST_CONTEXT);
});

describe('vercel request context bridge', () => {
  it('preserves waitUntil and other own properties', () => {
    const recorded: unknown[] = [];
    const original = {
      region: 'iad1',
      marker: 'platform',
      waitUntil(promise: Promise<unknown>) {
        recorded.push(this === original);
        recorded.push(promise);
      },
      get() {
        return { headers: { 'x-existing': '1' } };
      },
    };
    installContext(original);

    attachOidcHeaderBridge();

    const bridge = bridgedContext();
    const pending = Promise.resolve('background');
    bridge.waitUntil(pending);

    expect(recorded).toEqual([true, pending]);
    expect(bridge.region).toBe('iad1');
    expect(bridge.marker).toBe('platform');
    expect(bridge.__revealuiOidcBridge).toBe(true);

    const sameWaitUntil = bridge.waitUntil;
    attachOidcHeaderBridge();
    expect(bridgedContext().waitUntil).toBe(sameWaitUntil);

    runWithOidcHeader('oidc-token', () => {
      const ctx = bridge.get();
      expect(ctx.headers?.['x-existing']).toBe('1');
      expect(ctx.headers?.[OIDC_HEADER]).toBe('oidc-token');
    });
  });

  it('preserves an inherited waitUntil', () => {
    const recorded: unknown[] = [];
    const proto: { waitUntil?: (promise: Promise<unknown>) => void } = {};
    const original = Object.create(proto) as {
      region: string;
      waitUntil: (promise: Promise<unknown>) => void;
    };
    original.region = 'sfo1';
    proto.waitUntil = function waitUntil(promise: Promise<unknown>) {
      recorded.push(this === original);
      recorded.push(promise);
    };
    installContext(original);

    attachOidcHeaderBridge();

    const pending = Promise.resolve('inherited');
    bridgedContext().waitUntil(pending);
    expect(recorded).toEqual([true, pending]);
    expect(bridgedContext().region).toBe('sfo1');
  });

  it('does not replace an OIDC token already on the context', () => {
    installContext({
      waitUntil() {
        return undefined;
      },
      get() {
        return { headers: { [OIDC_HEADER]: 'already-set' } };
      },
    });
    attachOidcHeaderBridge();

    runWithOidcHeader('incoming', () => {
      expect(bridgedContext().get().headers?.[OIDC_HEADER]).toBe('already-set');
    });
  });

  it('reads the OIDC header from a string or the first non-empty array value', () => {
    expect(readOidcHeader({ headers: { [OIDC_HEADER]: 'token-a' } })).toBe('token-a');
    expect(
      readOidcHeader({
        headers: { [OIDC_HEADER]: ['', 'token-b'] },
      }),
    ).toBe('token-b');
    expect(readOidcHeader({ headers: { [OIDC_HEADER]: '' } })).toBeUndefined();
    expect(readOidcHeader({ headers: {} })).toBeUndefined();
  });

  it('is the bridge installed by the Vercel entry', () => {
    const entry = readFileSync(resolve(__dirname, 'index.js'), 'utf8');
    expect(entry).toContain("from './request-context-bridge.js'");
    expect(entry).toContain('attachOidcHeaderBridge()');
  });
});
