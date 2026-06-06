import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES, isAdminRole } from '../access.js';

// ---------------------------------------------------------------------------
// isAdminRole — server-side admin/owner gate for admin-gated REST routes.
// ---------------------------------------------------------------------------
describe('isAdminRole', () => {
  it('grants the canonical owner DB role', () => {
    // Per #1219 an owner account carries DB role='owner'. This is the gap the
    // pre-consolidation per-route Sets (['admin','super-admin']) missed.
    expect(isAdminRole('owner')).toBe(true);
  });

  it('grants the legacy admin role', () => {
    expect(isAdminRole('admin')).toBe(true);
  });

  it('grants the app-layer super-admin value (kept for parity)', () => {
    expect(isAdminRole('super-admin')).toBe(true);
  });

  it('denies non-admin DB roles', () => {
    expect(isAdminRole('editor')).toBe(false);
    expect(isAdminRole('viewer')).toBe(false);
    expect(isAdminRole('contributor')).toBe(false);
    expect(isAdminRole('agent')).toBe(false);
  });

  it('denies null / undefined / empty role', () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('exposes the underlying role set', () => {
    expect(ADMIN_ROLES.has('owner')).toBe(true);
    expect(ADMIN_ROLES.has('editor')).toBe(false);
  });
});
