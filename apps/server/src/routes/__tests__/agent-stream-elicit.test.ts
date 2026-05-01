/**
 * Integration tests for `POST /api/agent-stream/elicit`. Hermetic — no DB,
 * no HTTP, no file I/O. Mounts the real route on a fresh Hono app with a
 * stub auth middleware that seeds `c.var.user`.
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetAgentRunSessions,
  awaitElicitationResponse,
  createAgentRunSession,
} from '../../lib/agent-run-sessions.js';
import elicitRoute from '../agent-stream-elicit.js';

function createApp(user: { id: string; role: string } | null) {
  const app = new Hono<{ Variables: { user?: { id: string; role: string } } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    await next();
  });
  app.route('/agent-stream/elicit', elicitRoute);
  return app;
}

async function postElicit(
  app: Hono,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await app.request('/agent-stream/elicit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

beforeEach(() => {
  _resetAgentRunSessions();
});

afterEach(() => {
  _resetAgentRunSessions();
});

describe('POST /agent-stream/elicit', () => {
  it('resolves a pending elicitation on accept', async () => {
    const session = createAgentRunSession('user-1');
    const pending = awaitElicitationResponse(session.sessionId, 'elicit-1');

    const app = createApp({ id: 'user-1', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'elicit-1',
      action: 'accept',
      content: { answer: 42 },
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ success: true });
    await expect(pending).resolves.toEqual({
      action: 'accept',
      content: { answer: 42 },
    });
  });

  it('resolves a pending elicitation on decline (content dropped)', async () => {
    const session = createAgentRunSession('user-1');
    const pending = awaitElicitationResponse(session.sessionId, 'elicit-1');

    const app = createApp({ id: 'user-1', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'elicit-1',
      action: 'decline',
      content: { shouldBeDropped: true },
    });

    expect(res.status).toBe(200);
    await expect(pending).resolves.toEqual({ action: 'decline' });
  });

  it('returns 401 when the caller is unauthenticated', async () => {
    const session = createAgentRunSession('user-1');
    awaitElicitationResponse(session.sessionId, 'elicit-1');

    const app = createApp(null);
    const res = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'elicit-1',
      action: 'accept',
    });

    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ success: false });
  });

  it('returns 403 when the session belongs to a different user', async () => {
    const session = createAgentRunSession('user-1');
    awaitElicitationResponse(session.sessionId, 'elicit-1');

    const app = createApp({ id: 'user-2', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'elicit-1',
      action: 'accept',
    });

    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ success: false });
  });

  it('returns 404 when the session is unknown', async () => {
    const app = createApp({ id: 'user-1', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: '00000000-0000-4000-8000-000000000000',
      elicitationId: 'elicit-1',
      action: 'cancel',
    });

    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ success: false });
  });

  it('returns 404 when the elicitation id is unknown for an existing session', async () => {
    const session = createAgentRunSession('user-1');
    awaitElicitationResponse(session.sessionId, 'registered');

    const app = createApp({ id: 'user-1', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'not-registered',
      action: 'accept',
    });

    expect(res.status).toBe(404);
  });

  it('rejects a second POST for the same elicitation id (one-shot)', async () => {
    const session = createAgentRunSession('user-1');
    const pending = awaitElicitationResponse(session.sessionId, 'elicit-1');

    const app = createApp({ id: 'user-1', role: 'admin' });
    const first = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'elicit-1',
      action: 'accept',
      content: { n: 1 },
    });
    const second = await postElicit(app, {
      sessionId: session.sessionId,
      elicitationId: 'elicit-1',
      action: 'accept',
      content: { n: 2 },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    await expect(pending).resolves.toEqual({ action: 'accept', content: { n: 1 } });
  });

  it('validates body shape (rejects non-uuid sessionId)', async () => {
    const app = createApp({ id: 'user-1', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: 'not-a-uuid',
      elicitationId: 'elicit-1',
      action: 'accept',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('validates body shape (rejects invalid action)', async () => {
    const app = createApp({ id: 'user-1', role: 'admin' });
    const res = await postElicit(app, {
      sessionId: crypto.randomUUID(),
      elicitationId: 'elicit-1',
      action: 'invalid',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
