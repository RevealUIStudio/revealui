/**
 * call-sessions unit tests (Stage 3.4).
 *
 * Exercises the in-memory session registry that bridges the streaming
 * call-tool route and the elicitation-respond route.
 */

import { describe, expect, it } from 'vitest';
import {
  awaitElicitationResponse,
  createCallSession,
  deleteCallSession,
  getCallSession,
  resolveElicitation,
} from '../call-sessions';

describe('call-sessions', () => {
  it('createCallSession registers a retrievable session', () => {
    const session = createCallSession('admin-1');
    expect(session.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(session.userId).toBe('admin-1');
    expect(getCallSession(session.sessionId)).toBe(session);
    deleteCallSession(session.sessionId);
  });

  it('awaitElicitationResponse resolves when resolveElicitation is called with a match', async () => {
    const session = createCallSession('admin-1');
    const elicitationId = 'e-1';
    const pending = awaitElicitationResponse(session.sessionId, elicitationId);
    const resolved = resolveElicitation(session.sessionId, elicitationId, {
      action: 'accept',
      content: { name: 'alice' },
    });
    expect(resolved).toBe(true);
    await expect(pending).resolves.toEqual({
      action: 'accept',
      content: { name: 'alice' },
    });
    deleteCallSession(session.sessionId);
  });

  it('resolveElicitation returns false when no matching pending exists', () => {
    const session = createCallSession('admin-1');
    expect(resolveElicitation(session.sessionId, 'nope', { action: 'cancel' })).toBe(false);
    deleteCallSession(session.sessionId);
  });

  it('deleteCallSession cancels every outstanding elicitation', async () => {
    const session = createCallSession('admin-1');
    const a = awaitElicitationResponse(session.sessionId, 'e-a');
    const b = awaitElicitationResponse(session.sessionId, 'e-b');
    deleteCallSession(session.sessionId);
    await expect(a).resolves.toEqual({ action: 'cancel' });
    await expect(b).resolves.toEqual({ action: 'cancel' });
    expect(getCallSession(session.sessionId)).toBeUndefined();
  });

  it('awaitElicitationResponse for an unknown session resolves with cancel', async () => {
    await expect(
      awaitElicitationResponse('00000000-0000-0000-0000-000000000000', 'e-x'),
    ).resolves.toEqual({ action: 'cancel' });
  });

  it('resolveElicitation is single-use — a second call for the same id returns false', () => {
    const session = createCallSession('admin-1');
    void awaitElicitationResponse(session.sessionId, 'e-1');
    expect(resolveElicitation(session.sessionId, 'e-1', { action: 'accept', content: {} })).toBe(
      true,
    );
    expect(resolveElicitation(session.sessionId, 'e-1', { action: 'accept', content: {} })).toBe(
      false,
    );
    deleteCallSession(session.sessionId);
  });
});
