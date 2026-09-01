/**
 * Tests for the public contact route — founder email + studio lead insert.
 *
 * Covered:
 *   - honeypot: non-empty `website` → 200, no email, no lead
 *   - valid inquiry: emails founder and inserts a lead with site source
 *   - source defaults to marketing when omitted
 *   - agency source is persisted on the lead
 *   - email failure → 500, no lead insert
 *   - lead insert failure after email → still 200
 *   - invalid payload → 400
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
  leads: { email: 'email' },
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { getClient } from '@revealui/db';
import { sendEmail } from '../../lib/email.js';
import contactApp from '../contact.js';

const mockedGetClient = vi.mocked(getClient);
const mockedSendEmail = vi.mocked(sendEmail);

function makeDb(insertResult: ReturnType<typeof vi.fn>) {
  const values = vi.fn(() => insertResult());
  const insert = vi.fn(() => ({ values }));
  return { db: { insert }, insert, values };
}

function createApp() {
  const app = new Hono();
  app.route('/contact', contactApp);
  return app;
}

const validBody = {
  source: 'agency' as const,
  topic: 'intro-call',
  name: 'Jordan Lee',
  email: 'jordan@example.com',
  company: 'Acme Studio',
  message: 'We want to book an intro about a studio pilot engagement.',
};

async function post(app: Hono, body: unknown) {
  return app.request('/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('contact route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSendEmail.mockResolvedValue(undefined);
  });

  it('trips the honeypot silently (200, no email, no lead)', async () => {
    const { db, insert } = makeDb(vi.fn().mockResolvedValue(undefined));
    mockedGetClient.mockReturnValue(db as never);

    const res = await post(createApp(), { ...validBody, website: 'http://spam.example' });

    expect(res.status).toBe(200);
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('emails the founder and inserts a lead from the submitting site', async () => {
    const { db, insert, values } = makeDb(vi.fn().mockResolvedValue(undefined));
    mockedGetClient.mockReturnValue(db as never);

    const res = await post(createApp(), validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'founder@revealui.com',
        replyTo: 'jordan@example.com',
      }),
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        company: 'Acme Studio',
        source: 'agency',
        status: 'lead',
        notes: expect.stringContaining('intro-call'),
      }),
    );
  });

  it('defaults source to marketing when omitted', async () => {
    const { db, values } = makeDb(vi.fn().mockResolvedValue(undefined));
    mockedGetClient.mockReturnValue(db as never);

    await post(createApp(), {
      topic: validBody.topic,
      name: validBody.name,
      email: validBody.email,
      company: validBody.company,
      message: validBody.message,
    });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ source: 'marketing' }));
  });

  it('returns 500 and skips the lead when email send fails', async () => {
    const { db, insert } = makeDb(vi.fn().mockResolvedValue(undefined));
    mockedGetClient.mockReturnValue(db as never);
    mockedSendEmail.mockRejectedValueOnce(new Error('smtp down'));

    const res = await post(createApp(), validBody);

    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });

  it('still returns 200 when lead insert fails after email', async () => {
    const { db } = makeDb(vi.fn().mockRejectedValue(new Error('db down')));
    mockedGetClient.mockReturnValue(db as never);

    const res = await post(createApp(), validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a short message (400)', async () => {
    const { db } = makeDb(vi.fn().mockResolvedValue(undefined));
    mockedGetClient.mockReturnValue(db as never);

    const res = await post(createApp(), { ...validBody, message: 'too short' });
    expect(res.status).toBe(400);
  });
});
