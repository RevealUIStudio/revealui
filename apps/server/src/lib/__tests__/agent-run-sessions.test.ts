/**
 * Unit tests for the process-local agent-run session registry. Hermetic —
 * no HTTP, no DB, no filesystem. Each `describe` block resets the
 * registry in a `beforeEach` so sessions from one block don't leak.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetAgentRunSessions,
  awaitElicitationResponse,
  createAgentRunSession,
  deleteAgentRunSession,
  getAgentRunSession,
  resolveElicitation,
} from '../agent-run-sessions.js';

beforeEach(() => {
  _resetAgentRunSessions();
});

afterEach(() => {
  _resetAgentRunSessions();
});

describe('createAgentRunSession', () => {
  it('returns a session bound to the supplied user with a unique id', () => {
    const a = createAgentRunSession('user-1');
    const b = createAgentRunSession('user-2');

    expect(a.userId).toBe('user-1');
    expect(b.userId).toBe('user-2');
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.pending.size).toBe(0);
    expect(typeof a.createdAt).toBe('number');
  });
});

describe('getAgentRunSession', () => {
  it('returns the session when it exists', () => {
    const session = createAgentRunSession('user-1');
    expect(getAgentRunSession(session.sessionId)).toBe(session);
  });

  it('returns undefined for unknown session ids', () => {
    expect(getAgentRunSession('not-a-real-session')).toBeUndefined();
  });
});

describe('awaitElicitationResponse + resolveElicitation', () => {
  it('resolves the pending promise when a matching elicit response lands', async () => {
    const session = createAgentRunSession('user-1');
    const pending = awaitElicitationResponse(session.sessionId, 'elicit-1');

    const landed = resolveElicitation(session.sessionId, 'elicit-1', {
      action: 'accept',
      content: { ok: true },
    });

    expect(landed).toBe(true);
    await expect(pending).resolves.toEqual({
      action: 'accept',
      content: { ok: true },
    });
  });

  it('returns false when the session is unknown', () => {
    expect(resolveElicitation('missing-session', 'elicit-1', { action: 'cancel' })).toBe(false);
  });

  it('returns false when the elicitation id is unknown for an existing session', () => {
    const session = createAgentRunSession('user-1');
    expect(resolveElicitation(session.sessionId, 'not-registered', { action: 'cancel' })).toBe(
      false,
    );
  });

  it('drops the pending entry after resolving so a second response 404s', async () => {
    const session = createAgentRunSession('user-1');
    const pending = awaitElicitationResponse(session.sessionId, 'elicit-1');

    expect(resolveElicitation(session.sessionId, 'elicit-1', { action: 'decline' })).toBe(true);
    await pending;

    expect(resolveElicitation(session.sessionId, 'elicit-1', { action: 'accept' })).toBe(false);
  });

  it('resolves with cancel when awaiting on a non-existent session', async () => {
    const pending = awaitElicitationResponse('phantom-session', 'elicit-1');
    await expect(pending).resolves.toEqual({ action: 'cancel' });
  });
});

describe('deleteAgentRunSession', () => {
  it('removes the session', () => {
    const session = createAgentRunSession('user-1');
    deleteAgentRunSession(session.sessionId);
    expect(getAgentRunSession(session.sessionId)).toBeUndefined();
  });

  it('resolves any outstanding elicitation with cancel', async () => {
    const session = createAgentRunSession('user-1');
    const a = awaitElicitationResponse(session.sessionId, 'elicit-a');
    const b = awaitElicitationResponse(session.sessionId, 'elicit-b');

    deleteAgentRunSession(session.sessionId);

    await expect(a).resolves.toEqual({ action: 'cancel' });
    await expect(b).resolves.toEqual({ action: 'cancel' });
  });

  it('is a no-op when the session does not exist', () => {
    expect(() => deleteAgentRunSession('phantom')).not.toThrow();
  });
});
