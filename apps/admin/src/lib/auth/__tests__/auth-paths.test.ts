import { describe, expect, it } from 'vitest';
import { AUTH_PATHS, isAuthPath } from '../auth-paths';

describe('isAuthPath', () => {
  it.each([...AUTH_PATHS])('matches %s', (path) => {
    expect(isAuthPath(path)).toBe(true);
  });

  it('matches nested auth paths', () => {
    expect(isAuthPath('/login/')).toBe(true);
    expect(isAuthPath('/reset-password?token=abc')).toBe(true);
  });

  it('does not match dashboard or welcome', () => {
    expect(isAuthPath('/')).toBe(false);
    expect(isAuthPath('/welcome')).toBe(false);
    expect(isAuthPath('/account/billing')).toBe(false);
    expect(isAuthPath('/settings')).toBe(false);
  });
});
