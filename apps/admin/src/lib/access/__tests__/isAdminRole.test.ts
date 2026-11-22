import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminRole } from '../roles/isAdminRole';

describe('isAdminRole', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('grants admin to owner on forge, and to admin and super-admin', () => {
    expect(isAdminRole('owner', 'forge')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('super-admin')).toBe(true);
  });

  it('denies a bare owner when deployment mode is unset or hosted', () => {
    vi.stubEnv('REVEALUI_DEPLOYMENT_MODE', '');
    expect(isAdminRole('owner')).toBe(false);
    expect(isAdminRole('owner', 'hosted')).toBe(false);
    expect(isAdminRole('admin')).toBe(true);
  });

  it('denies non-admin roles', () => {
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole('tenant-admin')).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('denies null / undefined', () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
