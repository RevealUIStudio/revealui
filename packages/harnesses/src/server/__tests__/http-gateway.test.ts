import { createHash, createHmac } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DaemonStore } from '../../storage/daemon-store.js';
import {
  type AuthTuning,
  HttpGateway,
  isPreAuthRoute,
  PairingRateLimiter,
  PRE_AUTH_ROUTES,
} from '../http-gateway.js';
import type { RpcServer } from '../rpc-server.js';

/** A stub RpcServer.dispatchHttp that records calls and replies with a success envelope. */
function makeDispatchStub(): RpcServer & { dispatchHttp: ReturnType<typeof vi.fn> } {
  const dispatchHttp = vi.fn((body: string, reply: (response: unknown) => void) => {
    const req = JSON.parse(body) as { id: number | string | null; method: string };
    reply({ jsonrpc: '2.0', id: req.id, result: { ok: true, method: req.method } });
  });
  return { dispatchHttp } as unknown as RpcServer & {
    dispatchHttp: ReturnType<typeof vi.fn>;
  };
}

interface Harness {
  gateway: HttpGateway;
  store: DaemonStore;
  dispatch: ReturnType<typeof vi.fn>;
  secretPath: string;
  base: string;
  dir: string;
}

const dirs: string[] = [];
const gateways: HttpGateway[] = [];
const stores: DaemonStore[] = [];

async function boot(opts?: {
  authTuning?: AuthTuning;
  preSecret?: { contents: string; mode?: number };
  seedStore?: (store: DaemonStore) => Promise<void>;
  dir?: string;
}): Promise<Harness> {
  const dir = opts?.dir ?? mkdtempSync(join(tmpdir(), 'gw-authn-'));
  dirs.push(dir);
  const secretPath = join(dir, 'pairing-secret');
  if (opts?.preSecret) {
    writeFileSync(secretPath, opts.preSecret.contents, { mode: opts.preSecret.mode ?? 0o600 });
    chmodSync(secretPath, opts.preSecret.mode ?? 0o600);
  }

  const store = new DaemonStore({ dataDir: '' });
  await store.init();
  stores.push(store);
  if (opts?.seedStore) await opts.seedStore(store);

  const dispatch = makeDispatchStub();
  const gateway = new HttpGateway({
    port: 0,
    host: '127.0.0.1',
    rpcDispatch: dispatch,
    store,
    secretPath,
    authTuning: opts?.authTuning,
  });
  gateways.push(gateway);
  await gateway.initAuth();
  await gateway.start();

  return {
    gateway,
    store,
    dispatch: dispatch.dispatchHttp,
    secretPath,
    base: `http://127.0.0.1:${gateway.getPort()}`,
    dir,
  };
}

/** Run the full challenge-response pairing flow and return the minted bearer token. */
async function pair(h: Harness, label?: string): Promise<string> {
  const nonceRes = await fetch(`${h.base}/api/pair`);
  expect(nonceRes.status).toBe(200);
  const { nonce } = (await nonceRes.json()) as { nonce: string };
  const secret = readFileSync(h.secretPath, 'utf8').trim();
  const hmac = createHmac('sha256', secret).update(nonce).digest('hex');
  const pairRes = await fetch(`${h.base}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce, hmac, label }),
  });
  expect(pairRes.status).toBe(200);
  const { token } = (await pairRes.json()) as { token: string };
  return token;
}

function rpc(base: string, method: string, token?: string): Promise<Response> {
  return fetch(`${base}/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
  });
}

afterEach(async () => {
  await Promise.all(gateways.splice(0).map((g) => g.stop()));
  await Promise.all(stores.splice(0).map((s) => s.close()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('HttpGateway fail-closed auth (GAP-353 PR-2)', () => {
  describe('headline: a never-paired daemon refuses unauthenticated spawn/stop', () => {
    it('refuses unauthenticated agent.spawn without reaching dispatch', async () => {
      const h = await boot();
      const res = await rpc(h.base, 'agent.spawn');
      expect(res.status).toBe(401);
      expect(h.dispatch).not.toHaveBeenCalled();
    });

    it('refuses unauthenticated agent.stop without reaching dispatch', async () => {
      const h = await boot();
      const res = await rpc(h.base, 'agent.stop');
      expect(res.status).toBe(401);
      expect(h.dispatch).not.toHaveBeenCalled();
    });

    it('refuses every unauthenticated /api/* route (nothing but pairing is pre-auth)', async () => {
      const h = await boot();
      const status = await fetch(`${h.base}/api/status`);
      expect(status.status).toBe(401);
      const stream = await fetch(`${h.base}/api/stream`);
      expect(stream.status).toBe(401);
    });
  });

  describe('challenge-response pairing', () => {
    it('mints a token on correct HMAC and authenticates spawn/stop with it', async () => {
      const h = await boot();
      const token = await pair(h, 'studio-macbook');

      const spawn = await rpc(h.base, 'agent.spawn', token);
      expect(spawn.status).toBe(200);
      expect(h.dispatch).toHaveBeenCalledTimes(1);

      const stop = await rpc(h.base, 'agent.stop', token);
      expect(stop.status).toBe(200);
      expect(h.dispatch).toHaveBeenCalledTimes(2);
    });

    it('persists the token hash (never the plaintext) with expiry and label', async () => {
      const h = await boot();
      const token = await pair(h, 'studio-macbook');
      const row = await h.store.findValidToken(
        // sha256(token) is what must be stored, not the token itself
        createHash('sha256').update(token).digest('hex'),
      );
      expect(row).not.toBeNull();
      expect(row?.label).toBe('studio-macbook');
      expect(row?.expires_at).not.toBeNull();
      expect(await h.store.findValidToken(token)).toBeNull(); // plaintext is not a stored key
    });

    it('rejects a wrong HMAC with 403', async () => {
      const h = await boot();
      const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const res = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac: 'deadbeef'.repeat(8) }),
      });
      expect(res.status).toBe(403);
    });

    it('does not accept a consumed nonce a second time', async () => {
      const h = await boot();
      const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const secret = readFileSync(h.secretPath, 'utf8').trim();
      const hmac = createHmac('sha256', secret).update(nonce).digest('hex');

      const first = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac }),
      });
      expect(first.status).toBe(200);

      const replay = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac }),
      });
      expect(replay.status).toBe(403);
    });

    it('consumes the nonce even on a failed attempt (no retry with a correct HMAC)', async () => {
      const h = await boot();
      const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const secret = readFileSync(h.secretPath, 'utf8').trim();

      const wrong = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac: '00'.repeat(32) }),
      });
      expect(wrong.status).toBe(403);

      const correctHmac = createHmac('sha256', secret).update(nonce).digest('hex');
      const retry = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac: correctHmac }),
      });
      expect(retry.status).toBe(403);
    });

    it('rejects an expired nonce', async () => {
      let clock = 1_000_000;
      const h = await boot({ authTuning: { now: () => clock, nonceTtlMs: 60_000 } });
      const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const secret = readFileSync(h.secretPath, 'utf8').trim();
      const hmac = createHmac('sha256', secret).update(nonce).digest('hex');

      clock += 60_001; // past the nonce TTL
      const res = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('rate limit + lockout (§D5)', () => {
    it('locks a source out after repeated failures and clears after the window', async () => {
      let clock = 5_000_000;
      const h = await boot({
        authTuning: {
          now: () => clock,
          lockoutThreshold: 3,
          baseLockoutMs: 30_000,
          globalFailureCeiling: 1000,
        },
      });
      const secret = readFileSync(h.secretPath, 'utf8').trim();

      // Three wrong attempts (each needs a fresh nonce) trip the lockout.
      for (let i = 0; i < 3; i++) {
        const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
        const res = await fetch(`${h.base}/api/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce, hmac: '11'.repeat(32) }),
        });
        expect(res.status).toBe(403);
      }

      // A further attempt is locked out (429) before verification.
      const locked = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const goodHmac = createHmac('sha256', secret).update(locked.nonce).digest('hex');
      const lockedRes = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce: locked.nonce, hmac: goodHmac }),
      });
      expect(lockedRes.status).toBe(429);

      // After the lockout window elapses, a correct pairing succeeds again.
      clock += 30_001;
      const token = await pair(h);
      expect(token).toHaveLength(64);
    });
  });

  describe('restart durability (§D2)', () => {
    it('keeps a previously-issued token valid across a new gateway instance', async () => {
      const h = await boot();
      const token = await pair(h);
      await h.gateway.stop();

      // New gateway instance, SAME store + secret file (simulated daemon restart).
      const dispatch2 = makeDispatchStub();
      const gateway2 = new HttpGateway({
        port: 0,
        host: '127.0.0.1',
        rpcDispatch: dispatch2,
        store: h.store,
        secretPath: h.secretPath,
      });
      gateways.push(gateway2);
      await gateway2.initAuth();
      await gateway2.start();
      const base2 = `http://127.0.0.1:${gateway2.getPort()}`;

      // Old token still authenticates  -  no reopened fail-open window.
      const authed = await rpc(base2, 'agent.spawn', token);
      expect(authed.status).toBe(200);
      // An unauthenticated call still 401s.
      const unauth = await rpc(base2, 'agent.spawn');
      expect(unauth.status).toBe(401);
    });
  });

  describe('boot honesty (§D7 / §7 R5)', () => {
    it('re-hashes an existing secret file into a fresh store (§7 R5)', async () => {
      const contents = 'a'.repeat(64);
      const h = await boot({ preSecret: { contents } });
      const stored = await h.store.getBootstrapSecretHash();
      const expected = createHash('sha256').update(contents).digest('hex');
      expect(stored).toBe(expected);
      // Pairing works against the adopted secret.
      const token = await pair(h);
      expect(token).toHaveLength(64);
    });

    it('refuses new pairings when the file is gone but a hash is on record; existing tokens still work', async () => {
      const knownToken = 'f'.repeat(64);
      const tokenHash = createHash('sha256').update(knownToken).digest('hex');
      const h = await boot({
        seedStore: async (store) => {
          await store.putBootstrapSecretHash('some-recorded-hash');
          await store.insertToken({ tokenHash });
        },
      });

      // No secret file was created (preSecret omitted) but a hash is on record → refuse pairing.
      const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const pairRes = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac: '22'.repeat(32) }),
      });
      expect(pairRes.status).toBe(503);

      // The pre-existing token still authenticates.
      const authed = await rpc(h.base, 'agent.spawn', knownToken);
      expect(authed.status).toBe(200);
    });

    it('refuses to use a group/other-readable secret file (§D7)', async () => {
      const h = await boot({ preSecret: { contents: 'b'.repeat(64), mode: 0o644 } });
      const { nonce } = (await (await fetch(`${h.base}/api/pair`)).json()) as { nonce: string };
      const secret = readFileSync(h.secretPath, 'utf8').trim();
      const hmac = createHmac('sha256', secret).update(nonce).digest('hex');
      const res = await fetch(`${h.base}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, hmac }),
      });
      expect(res.status).toBe(503);
    });
  });

  describe('pre-auth allowlist is an explicit constant (§7 R3)', () => {
    it('contains exactly the two pairing endpoints', () => {
      expect(PRE_AUTH_ROUTES).toEqual([
        { method: 'GET', path: '/api/pair' },
        { method: 'POST', path: '/api/pair' },
      ]);
    });

    it('classifies routes correctly', () => {
      expect(isPreAuthRoute('GET', '/api/pair')).toBe(true);
      expect(isPreAuthRoute('POST', '/api/pair')).toBe(true);
      expect(isPreAuthRoute('POST', '/rpc')).toBe(false);
      expect(isPreAuthRoute('GET', '/api/status')).toBe(false);
      expect(isPreAuthRoute('GET', '/api/stream')).toBe(false);
    });
  });
});

describe('PairingRateLimiter', () => {
  it('applies exponential backoff past the threshold, capped at the ceiling', () => {
    const clock = 0;
    const rl = new PairingRateLimiter({
      now: () => clock,
      lockoutThreshold: 3,
      baseLockoutMs: 1000,
      maxLockoutMs: 4000,
      globalCeiling: 1000,
    });
    const src = '1.2.3.4';
    expect(rl.recordFailure(src).lockMs).toBe(0); // 1
    expect(rl.recordFailure(src).lockMs).toBe(0); // 2
    expect(rl.recordFailure(src).lockMs).toBe(1000); // 3  -  base
    expect(rl.recordFailure(src).lockMs).toBe(2000); // 4  -  base*2
    expect(rl.recordFailure(src).lockMs).toBe(4000); // 5  -  base*4
    expect(rl.recordFailure(src).lockMs).toBe(4000); // 6  -  capped at ceiling
  });

  it('reports a source as locked until the window elapses, and clears on success', () => {
    let clock = 0;
    const rl = new PairingRateLimiter({
      now: () => clock,
      lockoutThreshold: 1,
      baseLockoutMs: 5000,
      maxLockoutMs: 5000,
      globalCeiling: 1000,
    });
    const src = '9.9.9.9';
    rl.recordFailure(src);
    expect(rl.retryAfterMs(src)).toBe(5000);
    clock += 5000;
    expect(rl.retryAfterMs(src)).toBe(0);

    rl.recordFailure(src);
    rl.recordSuccess(src);
    expect(rl.retryAfterMs(src)).toBe(0);
  });

  it('trips a global cooldown at the global ceiling across sources', () => {
    const clock = 0;
    const rl = new PairingRateLimiter({
      now: () => clock,
      lockoutThreshold: 1000,
      baseLockoutMs: 2000,
      maxLockoutMs: 2000,
      globalCeiling: 3,
    });
    expect(rl.recordFailure('a').globalTripped).toBe(false);
    expect(rl.recordFailure('b').globalTripped).toBe(false);
    expect(rl.recordFailure('c').globalTripped).toBe(true);
    // A brand-new source is nonetheless locked out by the global cooldown.
    expect(rl.retryAfterMs('z')).toBe(2000);
  });
});
