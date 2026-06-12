import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { navigateAfterAuthChange } from '../auth-navigation';

describe('navigateAfterAuthChange', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // jsdom's location is read-only; swap in a writable double (same pattern
    // as packages/auth/src/react/__tests__/useSignOut.test.tsx).
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('performs a full document navigation via location.href', () => {
    navigateAfterAuthChange('/');
    expect(window.location.href).toBe('/');
  });

  it('passes through paths with query strings', () => {
    navigateAfterAuthChange('/account/billing?upgrade=pro');
    expect(window.location.href).toBe('/account/billing?upgrade=pro');
  });
});
