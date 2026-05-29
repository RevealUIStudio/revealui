/**
 * Tests for the waitlist route — public source-tagged email capture.
 *
 * Covered:
 *   - honeypot: non-empty `website` → 200, no DB write
 *   - valid signup: inserts with onConflictDoUpdate, 200
 *   - email is normalized (trim + lowercase) before insert
 *   - source defaults to 'landing-page' when omitted
 *   - invalid email → 400 (zValidator)
 *   - invalid source → 400 (zValidator enum)
 *   - DB error → 500 with friendly message
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
}));

vi.mock('@revealui/db/schema', () => ({
  waitlist: { email: 'email' },
}));

import { getClient } from '@revealui/db';
import waitlistApp from '../waitlist.js';

const mockedGetClient = vi.mocked(getClient);

/** Builds a chainable insert mock: insert().values().onConflictDoUpdate() */
function makeDb(onConflict: ReturnType<typeof vi.fn>) {
  const values = vi.fn(() => ({ onConflictDoUpdate: onConflict }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert }, insert, values, onConflict };
}

function createApp() {
  const app = new Hono();
  app.route('/waitlist', waitlistApp);
  return app;
}

async function post(app: Hono, body: unknown) {
  return app.request('/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('waitlist route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trips the honeypot silently (200, no DB write)', async () => {
    const { db, insert } = makeDb(vi.fn().mockResolvedValue(undefined));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    const res = await post(createApp(), {
      email: 'bot@example.com',
      source: 'managed-cloud',
      website: 'http://spam.example',
    });

    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('captures a valid signup (200, onConflictDoUpdate called)', async () => {
    const onConflict = vi.fn().mockResolvedValue(undefined);
    const { db, insert, values } = makeDb(onConflict);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    const res = await post(createApp(), { email: 'op@example.com', source: 'managed-cloud' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'op@example.com', source: 'managed-cloud' }),
    );
    expect(onConflict).toHaveBeenCalledTimes(1);
  });

  it('normalizes email (trim + lowercase) before insert', async () => {
    const { db, values } = makeDb(vi.fn().mockResolvedValue(undefined));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    await post(createApp(), { email: '  OP@Example.COM  ', source: 'newsletter' });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'op@example.com', source: 'newsletter' }),
    );
  });

  it('defaults source to landing-page when omitted', async () => {
    const { db, values } = makeDb(vi.fn().mockResolvedValue(undefined));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    await post(createApp(), { email: 'op@example.com' });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ source: 'landing-page' }));
  });

  it('rejects an invalid email (400)', async () => {
    const { db } = makeDb(vi.fn().mockResolvedValue(undefined));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    const res = await post(createApp(), { email: 'not-an-email', source: 'managed-cloud' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown source (400)', async () => {
    const { db } = makeDb(vi.fn().mockResolvedValue(undefined));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    const res = await post(createApp(), { email: 'op@example.com', source: 'arbitrary-junk' });
    expect(res.status).toBe(400);
  });

  it('returns 500 with a friendly message on DB error', async () => {
    const { db } = makeDb(vi.fn().mockRejectedValue(new Error('db down')));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    mockedGetClient.mockReturnValue(db as any);

    const res = await post(createApp(), { email: 'op@example.com', source: 'managed-cloud' });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('try again');
  });
});
