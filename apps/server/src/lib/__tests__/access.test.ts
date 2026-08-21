import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES, isAdminRole, isFleetOperator } from '../access.js';
import type { ApiAuthUser } from '../api-roles.js';

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

describe('isFleetOperator', () => {
  const operator: ApiAuthUser = {
    id: 'op-1',
    role: 'admin',
    emailVerified: true,
    _json: { roles: ['super-admin'] },
  };

  it('grants a verified platform operator', () => {
    expect(isFleetOperator(operator)).toBe(true);
  });

  it('denies a tenant owner even when DB role is owner', () => {
    expect(isFleetOperator({ id: 't1', role: 'owner', emailVerified: true })).toBe(false);
  });

  it('denies a tenant admin promoted from membership owner', () => {
    expect(isFleetOperator({ id: 't2', role: 'admin', emailVerified: true })).toBe(false);
  });

  it('denies null / undefined', () => {
    expect(isFleetOperator(null)).toBe(false);
    expect(isFleetOperator(undefined)).toBe(false);
  });
});
