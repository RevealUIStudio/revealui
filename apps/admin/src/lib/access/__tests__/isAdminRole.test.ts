import { describe, expect, it } from 'vitest';
import { isAdminRole } from '../roles/isAdminRole';

describe('isAdminRole', () => {
  it('grants admin to owner, admin, and super-admin', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('super-admin')).toBe(true);
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
