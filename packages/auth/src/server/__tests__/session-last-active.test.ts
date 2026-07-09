/**
 * Tests for the throttled users.lastActiveAt writer inside getSession().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

interface UpdateCall {
  values: Record<string, unknown>;
}

const updateCalls: UpdateCall[] = [];
let selectQueue: unknown[][] = [];

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateCalls.push({ values });
        return { where: vi.fn(() => Promise.resolve()) };
      }),
    })),
  })),
}));

import { getSession } from '../session.js';

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

function sessionRow() {
  return {
    id: 'session-1',
    userId: 'user-1',
    tokenHash: 'irrelevant',
    expiresAt: FUTURE,
    deletedAt: null,
    userAgent: null,
    ipAddress: null,
  };
}

function userRow(lastActiveAt: Date | null) {
  return {
    id: 'user-1',
    deletedAt: null,
    lastActiveAt,
  };
}

function headersWithCookie(): Headers {
  const headers = new Headers();
  headers.set('cookie', 'revealui-session=some-token');
  return headers;
}

describe('getSession lastActiveAt throttling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCalls.length = 0;
    selectQueue = [];
  });

  it('writes lastActiveAt when it has never been set', async () => {
    selectQueue = [[sessionRow()], [userRow(null)]];

    await getSession(headersWithCookie());

    const userUpdate = updateCalls.find((c) => 'lastActiveAt' in c.values);
    expect(userUpdate).toBeDefined();
  });

  it('writes lastActiveAt when stale (older than 60 minutes)', async () => {
    const staleAt = new Date(Date.now() - 61 * 60 * 1000);
    selectQueue = [[sessionRow()], [userRow(staleAt)]];

    await getSession(headersWithCookie());

    const userUpdate = updateCalls.find((c) => 'lastActiveAt' in c.values);
    expect(userUpdate).toBeDefined();
  });

  it('skips the write when lastActiveAt is within the throttle window', async () => {
    const recentAt = new Date(Date.now() - 5 * 60 * 1000);
    selectQueue = [[sessionRow()], [userRow(recentAt)]];

    await getSession(headersWithCookie());

    const userUpdate = updateCalls.find((c) => 'lastActiveAt' in c.values);
    expect(userUpdate).toBeUndefined();
  });
});
