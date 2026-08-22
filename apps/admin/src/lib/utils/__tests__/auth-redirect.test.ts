import { describe, expect, it } from 'vitest';
import {
  buildAuthIntentQuery,
  parseUpgrade,
  readAuthIntent,
  resolveAuthDest,
} from '../auth-redirect';

const reader = (params: Record<string, string | null>) => ({
  get: (k: string) => params[k] ?? null,
});

describe('parseUpgrade', () => {
  it('accepts the known paid-plan deep links including enterprise', () => {
    expect(parseUpgrade('pro')).toBe('pro');
    expect(parseUpgrade('max')).toBe('max');
    expect(parseUpgrade('enterprise')).toBe('enterprise');
  });

  it('rejects unknown values and null', () => {
    expect(parseUpgrade('enterprise-deluxe')).toBeNull();
    expect(parseUpgrade('')).toBeNull();
    expect(parseUpgrade(null)).toBeNull();
  });
});

describe('resolveAuthDest enterprise', () => {
  it('routes enterprise to the billing page (sales-assisted; no Stripe session)', () => {
    expect(resolveAuthDest({ upgrade: 'enterprise', redirect: null, fallback: '/welcome' })).toBe(
      '/account/billing?upgrade=enterprise',
    );
  });
});

describe('resolveAuthDest', () => {
  it('prefers upgrade over redirect and fallback', () => {
    expect(resolveAuthDest({ upgrade: 'pro', redirect: '/somewhere', fallback: '/welcome' })).toBe(
      '/account/billing?upgrade=pro',
    );
  });

  it('uses the redirect when there is no upgrade', () => {
    expect(resolveAuthDest({ upgrade: null, redirect: '/upgrade', fallback: '/welcome' })).toBe(
      '/upgrade',
    );
  });

  it('falls back when neither upgrade nor redirect is present', () => {
    expect(resolveAuthDest({ upgrade: null, redirect: null, fallback: '/welcome' })).toBe(
      '/welcome',
    );
  });
});

describe('buildAuthIntentQuery', () => {
  it('returns an empty string when there is no intent', () => {
    expect(buildAuthIntentQuery({ upgrade: null, redirect: null })).toBe('');
  });

  it('encodes upgrade and redirect into a query string', () => {
    const qs = buildAuthIntentQuery({ upgrade: 'max', redirect: '/upgrade?ref=email' });
    const parsed = new URLSearchParams(qs.slice(1));
    expect(parsed.get('upgrade')).toBe('max');
    expect(parsed.get('redirect')).toBe('/upgrade?ref=email');
  });
});

describe('readAuthIntent', () => {
  it('parses the upgrade and validates a same-origin redirect', () => {
    expect(readAuthIntent(reader({ upgrade: 'pro', redirect: '/upgrade' }))).toEqual({
      upgrade: 'pro',
      redirect: '/upgrade',
    });
  });

  it('drops an off-origin redirect and an invalid upgrade', () => {
    expect(readAuthIntent(reader({ upgrade: 'bogus', redirect: '//evil.com' }))).toEqual({
      upgrade: null,
      redirect: null,
    });
  });

  it('round-trips intent carried through an intermediate step', () => {
    // buildAuthIntentQuery (login) -> readAuthIntent (/mfa, /rotate-password)
    const qs = buildAuthIntentQuery({ upgrade: 'pro', redirect: '/upgrade?ref=email' });
    expect(readAuthIntent(new URLSearchParams(qs.slice(1)))).toEqual({
      upgrade: 'pro',
      redirect: '/upgrade?ref=email',
    });
  });

  it('treats ?returnUrl= as the redirect dest when ?redirect= is absent', () => {
    expect(readAuthIntent(reader({ returnUrl: '/account/license' }))).toEqual({
      upgrade: null,
      redirect: '/account/license',
    });
  });

  it('prefers ?redirect= over ?returnUrl=', () => {
    expect(readAuthIntent(reader({ redirect: '/account/license', returnUrl: '/welcome' }))).toEqual(
      {
        upgrade: null,
        redirect: '/account/license',
      },
    );
  });
});
