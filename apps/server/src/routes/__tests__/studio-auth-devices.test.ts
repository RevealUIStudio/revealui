/**
 * Studio device list + revoke (account-page surface).
 *
 * HC16: GET scoped to auth user; DELETE cannot deactivate another user's UUID.
 * HC16b: OTP studio-auth 5/min budget does not cover /devices.
 * HC19 API half: DELETE clears isActive + token fields.
 * Cookie sessions: current=false on every row; Bearer deviceAuth: current on match.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/auth/server', () => ({
  getStorage: () => ({
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
    exists: async () => false,
    incr: async () => 1,
  }),
  checkRateLimit: vi.fn(),
}));

const updateWhereSpy = vi.fn();
const updateSetSpy = vi.fn();
let selectResults: Record<string, unknown>[][] = [];
let lastUpdateSet: Record<string, unknown> | null = null;
let lastUpdateWhereArgs: unknown[] = [];

function createMockDb() {
  updateSetSpy.mockImplementation((values: Record<string, unknown>) => {
    lastUpdateSet = values;
    return {
      where: updateWhereSpy.mockImplementation((...args: unknown[]) => {
        lastUpdateWhereArgs = args;
        return Promise.resolve(undefined);
      }),
    };
  });

  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          const rows = selectResults.shift() ?? [];
          // List query has no .limit(); single-row queries chain .limit().
          const result = Promise.resolve(rows);
          return Object.assign(result, {
            limit: vi.fn().mockResolvedValue(rows),
          });
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: updateSetSpy,
    })),
    insert: vi.fn(),
  };
}

let mockDb = createMockDb();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  userDevices: {
    id: 'id',
    userId: 'userId',
    deviceId: 'deviceId',
    deviceName: 'deviceName',
    deviceType: 'deviceType',
    tokenHash: 'tokenHash',
    tokenExpiresAt: 'tokenExpiresAt',
    tokenIssuedAt: 'tokenIssuedAt',
    isActive: 'isActive',
    lastSeen: 'lastSeen',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@revealui/db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
    role: 'role',
  },
}));

import { checkRateLimit } from '@revealui/auth/server';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import studioAuth from '../studio-auth.js';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

const OWNER = { id: 'user-owner', email: 'owner@example.com', name: 'Owner', role: 'admin' };
const OTHER = { id: 'user-other', email: 'other@example.com', name: 'Other', role: 'admin' };

const OWNER_DEVICE_A = {
  deviceId: 'device-aaa',
  deviceName: 'Studio A',
  deviceType: 'desktop',
  lastSeen: new Date('2026-09-01T12:00:00.000Z'),
};
const OWNER_DEVICE_B = {
  deviceId: 'device-bbb',
  deviceName: 'CLI B',
  deviceType: 'cli',
  lastSeen: new Date('2026-09-02T12:00:00.000Z'),
};
const OTHER_DEVICE = {
  deviceId: 'device-other',
  deviceName: 'Other Studio',
  deviceType: 'desktop',
  lastSeen: new Date('2026-09-03T12:00:00.000Z'),
};

interface MountOpts {
  user: typeof OWNER;
  session: { id: string; deviceAuth?: boolean; deviceId?: string };
}

function mountDevices(opts: MountOpts): Hono {
  const app = new Hono();
  app.use('/studio-auth/devices', async (c, next) => {
    c.set('user', opts.user);
    c.set('session', opts.session);
    await next();
  });
  app.use('/studio-auth/devices/*', async (c, next) => {
    c.set('user', opts.user);
    c.set('session', opts.session);
    await next();
  });
  app.route('/studio-auth', studioAuth);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb();
  selectResults = [];
  lastUpdateSet = null;
  lastUpdateWhereArgs = [];
  mockedCheckRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  });
});

describe('HC16 GET /studio-auth/devices', () => {
  it('lists only devices for the authenticated user (no hashes)', async () => {
    selectResults.push([OWNER_DEVICE_A, OWNER_DEVICE_B]);

    const app = mountDevices({
      user: OWNER,
      session: { id: 'cookie-session' },
    });

    const res = await app.request('/studio-auth/devices');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      devices: Array<{
        id: string;
        name: string | null;
        type: string | null;
        lastSeen: string | null;
        current: boolean;
        tokenHash?: string;
      }>;
    };

    expect(body.devices).toHaveLength(2);
    expect(body.devices.map((d) => d.id).sort()).toEqual(['device-aaa', 'device-bbb']);
    expect(body.devices.every((d) => d.tokenHash === undefined)).toBe(true);
    expect(body.devices.find((d) => d.id === 'device-aaa')).toMatchObject({
      name: 'Studio A',
      type: 'desktop',
      lastSeen: '2026-09-01T12:00:00.000Z',
      current: false,
    });
  });

  it('cookie session: current is false on every row', async () => {
    selectResults.push([OWNER_DEVICE_A, OWNER_DEVICE_B]);

    const app = mountDevices({
      user: OWNER,
      session: { id: 'cookie-session', deviceAuth: false },
    });

    const res = await app.request('/studio-auth/devices');
    const body = (await res.json()) as { devices: Array<{ current: boolean }> };
    expect(body.devices.every((d) => d.current === false)).toBe(true);
  });

  it('Bearer deviceAuth: current true only on matching deviceId', async () => {
    selectResults.push([OWNER_DEVICE_A, OWNER_DEVICE_B]);

    const app = mountDevices({
      user: OWNER,
      session: { id: 'device-token', deviceAuth: true, deviceId: 'device-bbb' },
    });

    const res = await app.request('/studio-auth/devices');
    const body = (await res.json()) as { devices: Array<{ id: string; current: boolean }> };
    expect(body.devices.find((d) => d.id === 'device-bbb')?.current).toBe(true);
    expect(body.devices.find((d) => d.id === 'device-aaa')?.current).toBe(false);
  });
});

describe('HC16 / HC19 DELETE /studio-auth/devices/:deviceId', () => {
  it('deactivates the row for this user (isActive false, token fields null)', async () => {
    selectResults.push([{ id: 'row-aaa' }]);

    const app = mountDevices({
      user: OWNER,
      session: { id: 'cookie-session' },
    });

    const res = await app.request('/studio-auth/devices/device-aaa', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    expect(lastUpdateSet).toMatchObject({
      isActive: false,
      tokenHash: null,
      tokenExpiresAt: null,
      tokenIssuedAt: null,
    });
    expect(updateWhereSpy).toHaveBeenCalled();
    expect(lastUpdateWhereArgs.length).toBeGreaterThan(0);
  });

  it('returns 404 when no matching row for this user (cannot deactivate another user UUID)', async () => {
    selectResults.push([]); // select+limit empty → not owned / missing

    const app = mountDevices({
      user: OWNER,
      session: { id: 'cookie-session' },
    });

    const res = await app.request(`/studio-auth/devices/${OTHER_DEVICE.deviceId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('not found');
  });

  it('delete-all is allowed: last remaining device can be revoked', async () => {
    selectResults.push([{ id: 'row-only' }]);

    const app = mountDevices({
      user: OWNER,
      session: { id: 'cookie-session' },
    });

    const res = await app.request('/studio-auth/devices/device-only', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('other user context cannot clear owner device even when UUID is known', async () => {
    // Empty select simulates AND userId=other AND deviceId=owner's → 0 rows
    selectResults.push([]);

    const app = mountDevices({
      user: OTHER,
      session: { id: 'cookie-session' },
    });

    const res = await app.request('/studio-auth/devices/device-aaa', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('HC16b OTP glob does not match /devices', () => {
  it('index.ts registers OTP studio-auth on explicit paths only (not /devices glob)', () => {
    const indexSource = readFileSync(resolve(__dirname, '../../index.ts'), 'utf-8');

    expect(indexSource).not.toContain("app.use('/api/studio-auth/*', routeLimit('studio-auth'))");
    expect(indexSource).not.toContain(
      "app.use('/api/v1/studio-auth/*', routeLimit('studio-auth'))",
    );

    for (const path of ['link', 'verify', 'refresh', 'revoke', 'status']) {
      expect(indexSource).toContain(`\`/api/studio-auth/\${otpPath}\``);
      expect(indexSource.includes(`'${path}'`)).toBe(true);
    }

    expect(indexSource).toContain("'studio-auth-devices'");
    expect(indexSource).toContain('/api/studio-auth/devices');
    expect(indexSource).toContain('user:${');
  });

  it('6 hits on OTP budget do not 429 GET /devices when limiters are separate', async () => {
    const counters = new Map<string, number>();
    mockedCheckRateLimit.mockImplementation(async (key: string, opts: { maxAttempts: number }) => {
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      const allowed = count <= opts.maxAttempts;
      return {
        allowed,
        remaining: Math.max(0, opts.maxAttempts - count),
        resetAt: Date.now() + 60_000,
      };
    });

    const app = new Hono();
    // Mirror production: OTP paths only on studio-auth; devices on separate bucket.
    for (const otpPath of ['link', 'verify', 'refresh', 'revoke', 'status'] as const) {
      app.use(
        `/api/studio-auth/${otpPath}`,
        rateLimitMiddleware({
          maxRequests: 5,
          windowMs: 60_000,
          keyPrefix: 'studio-auth',
        }),
      );
    }
    app.use('/api/studio-auth/devices', async (c, next) => {
      c.set('user', OWNER);
      c.set('session', { id: 'cookie-session' });
      await next();
    });
    app.use(
      '/api/studio-auth/devices',
      rateLimitMiddleware({
        maxRequests: 30,
        windowMs: 60_000,
        keyPrefix: 'studio-auth-devices',
        resolveKey: (c) => `user:${(c.get('user') as { id: string }).id}`,
      }),
    );
    app.route('/api/studio-auth', studioAuth);

    selectResults.push([]); // empty device list for GETs

    for (let i = 0; i < 6; i += 1) {
      const otpRes = await app.request('/api/studio-auth/status');
      if (i < 5) {
        expect(otpRes.status).not.toBe(429);
      } else {
        expect(otpRes.status).toBe(429);
      }
    }

    selectResults.push([]);
    const devicesRes = await app.request('/api/studio-auth/devices');
    expect(devicesRes.status).not.toBe(429);
    expect(devicesRes.status).toBe(200);
  });
});
