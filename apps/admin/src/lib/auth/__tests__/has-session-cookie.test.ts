import { describe, expect, it } from 'vitest';
import { hasSessionCookie, shouldRedirectToLoginOnEmptySession } from '../has-session-cookie';

describe('hasSessionCookie', () => {
  it('is true when revealui-session has a value', () => {
    expect(hasSessionCookie('revealui-role=owner; revealui-session=sess-abc')).toBe(true);
  });

  it('is false when the cookie is missing or empty', () => {
    expect(hasSessionCookie('revealui-role=owner')).toBe(false);
    expect(hasSessionCookie('revealui-session=')).toBe(false);
    expect(hasSessionCookie('')).toBe(false);
  });
});

describe('shouldRedirectToLoginOnEmptySession', () => {
  const session = { user: { id: 'u1' } };

  it('never bounces while the session hook is loading', () => {
    expect(shouldRedirectToLoginOnEmptySession(null, true, '')).toBe(false);
  });

  it('never bounces when the session hook returned a user', () => {
    expect(shouldRedirectToLoginOnEmptySession(session, false, '')).toBe(false);
  });

  it('does not bounce on a one-shot empty session when the session cookie is present', () => {
    expect(shouldRedirectToLoginOnEmptySession(null, false, 'revealui-session=sess-abc')).toBe(
      false,
    );
  });

  it('bounces only when the hook is empty and no session cookie is present', () => {
    expect(shouldRedirectToLoginOnEmptySession(null, false, 'revealui-role=owner')).toBe(true);
  });
});
