import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectControllerStatus } from '../scripts/status.js';

const app = 'revealui-review-controller';
const token = 'private-status-token-never-print';

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function requestFor(input?: { live?: Response; ready?: Response; machines?: Response }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith('/health/live'))
      return input?.live ?? response({ ok: true, service: 'review-controller' });
    if (String(url).endsWith('/health/ready')) return input?.ready ?? response({ ok: true });
    if (String(url).endsWith('/machines'))
      return input?.machines ?? response([{ id: 'machine-1', state: 'started' }]);
    throw new Error('unexpected URL');
  }) as typeof fetch;
  return { request, calls };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('read-only Review Controller status', () => {
  it('uses only bounded GETs, returns distinct evidence labels, and does not write HOME', async () => {
    const home = join(tmpdir(), `revealfleet-status-no-home-${randomUUID()}`);
    vi.stubEnv('HOME', home);
    const { request, calls } = requestFor();
    const result = await collectControllerStatus({ app, flyReadToken: token, request });
    expect(result).toEqual({
      app,
      live: { ok: true, detail: 'http_live' },
      ready: { ok: true, detail: 'database_ready' },
      machine: { ok: true, detail: 'one_machine_started' },
      diagnosticsPassed: true,
      receiptEvidence: 'unverified',
    });
    expect(existsSync(home)).toBe(false);
    expect(calls).toHaveLength(3);
    expect(calls.every(({ init }) => init.method === 'GET' && init.redirect === 'error')).toBe(
      true,
    );
    expect(calls.map(({ url }) => url)).toEqual([
      `https://${app}.fly.dev/health/live`,
      `https://${app}.fly.dev/health/ready`,
      `https://api.machines.dev/v1/apps/${app}/machines`,
    ]);
    expect(calls[0]?.init.headers).not.toHaveProperty('authorization');
    expect(calls[1]?.init.headers).not.toHaveProperty('authorization');
    expect(calls[2]?.init.headers).toHaveProperty('authorization', `Bearer ${token}`);
  });

  it.each([401, 403])(
    'fails closed on Fly HTTP %i and never emits token or response body',
    async (code) => {
      const { request } = requestFor({ machines: response({ secret: token }, code) });
      const result = await collectControllerStatus({ app, flyReadToken: token, request });
      expect(result.diagnosticsPassed).toBe(false);
      expect(result.machine.detail).toBe(`authentication_rejected_${code}`);
      expect(JSON.stringify(result)).not.toContain(token);
    },
  );

  it('redacts a token-bearing transport error', async () => {
    const request = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/machines')) throw new Error(`connection failed: ${token}`);
      if (String(url).endsWith('/health/live'))
        return response({ ok: true, service: 'review-controller' });
      return response({ ok: true });
    }) as typeof fetch;
    const result = await collectControllerStatus({ app, flyReadToken: token, request });
    expect(result.machine).toEqual({ ok: false, detail: 'request_failed' });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it.each([
    [[]],
    [
      [
        { id: 'a', state: 'started' },
        { id: 'b', state: 'started' },
      ],
    ],
  ])('rejects non-singleton Machine inventory', async (machines) => {
    const { request } = requestFor({ machines: response(machines) });
    const result = await collectControllerStatus({ app, flyReadToken: token, request });
    expect(result.diagnosticsPassed).toBe(false);
    expect(result.machine.detail).toBe(`machine_count_${machines.length}`);
  });

  it('rejects a stopped Machine and database failure independently', async () => {
    const { request } = requestFor({
      ready: response({ ok: false }, 503),
      machines: response([{ id: 'machine-1', state: 'stopped' }]),
    });
    const result = await collectControllerStatus({ app, flyReadToken: token, request });
    expect(result.live.ok).toBe(true);
    expect(result.ready.ok).toBe(false);
    expect(result.machine).toEqual({ ok: false, detail: 'machine_not_started' });
    expect(result.diagnosticsPassed).toBe(false);
  });

  it('aborts and settles when a request never responds', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const request = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return new Promise<Response>(() => undefined);
    }) as typeof fetch;
    const pending = collectControllerStatus({ app, flyReadToken: token, request });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;
    expect(result.diagnosticsPassed).toBe(false);
    expect(result.live.detail).toBe('timeout');
    expect(result.ready.detail).toBe('timeout');
    expect(result.machine.detail).toBe('timeout');
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('refuses missing credentials and invalid app names before network access', async () => {
    const { request } = requestFor();
    await expect(collectControllerStatus({ app, flyReadToken: '', request })).rejects.toThrow(
      'FLY_READONLY_TOKEN is required',
    );
    await expect(
      collectControllerStatus({ app: 'other.example', flyReadToken: token, request }),
    ).rejects.toThrow('invalid app name');
    expect(request).not.toHaveBeenCalled();
  });
});
