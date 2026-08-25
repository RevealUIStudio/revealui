/**
 * Electric shape AuthZ helpers — fleet-operator vs hosted CMS admin/owner.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  isFleetOperator,
  requireAdminRole,
  userCanAccessSite,
  userCanAccessYjsDocument,
} from '../shape-authz.js';

function createDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, from, where, limit };
}

const FLEET_OPERATOR = {
  role: 'admin',
  emailVerified: true as const,
  _json: { roles: ['super-admin'] },
};

const HOSTED_ADMIN = {
  role: 'admin',
  emailVerified: true as const,
  _json: {},
};

const HOSTED_OWNER = {
  role: 'owner',
  emailVerified: true as const,
};

describe('requireAdminRole vs isFleetOperator', () => {
  it('treats hosted CMS admin/owner as shell admin, not fleet operator', () => {
    expect(requireAdminRole('admin')).toBe(true);
    expect(requireAdminRole('owner')).toBe(true);
    expect(isFleetOperator(HOSTED_ADMIN)).toBe(false);
    expect(isFleetOperator(HOSTED_OWNER)).toBe(false);
  });

  it('grants fleet operator only when verified email has super-admin in _json.roles', () => {
    expect(isFleetOperator(FLEET_OPERATOR)).toBe(true);
    expect(
      isFleetOperator({
        role: 'admin',
        emailVerified: false,
        _json: { roles: ['super-admin'] },
      }),
    ).toBe(false);
    expect(isFleetOperator(null)).toBe(false);
    expect(isFleetOperator(undefined)).toBe(false);
  });
});

describe('userCanAccessYjsDocument', () => {
  it('does not let a hosted CMS admin read another tenant document', async () => {
    const db = createDb([{ ownerId: 'other-user' }]);
    const allowed = await userCanAccessYjsDocument(
      db as never,
      'hosted-admin',
      'doc-1',
      HOSTED_ADMIN,
    );
    expect(allowed).toBe(false);
  });

  it('lets a document owner read their own document', async () => {
    const db = createDb([{ ownerId: 'hosted-admin' }]);
    const allowed = await userCanAccessYjsDocument(
      db as never,
      'hosted-admin',
      'doc-1',
      HOSTED_ADMIN,
    );
    expect(allowed).toBe(true);
  });

  it('lets a fleet operator read any document', async () => {
    const db = createDb([]);
    const allowed = await userCanAccessYjsDocument(db as never, 'op-1', 'doc-1', FLEET_OPERATOR);
    expect(allowed).toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('userCanAccessSite', () => {
  it('does not let a hosted CMS admin skip site ownership', async () => {
    const db = createDb([]);
    const allowed = await userCanAccessSite(
      db as never,
      'hosted-admin',
      'site-other',
      HOSTED_ADMIN,
    );
    expect(allowed).toBe(false);
  });

  it('lets a site owner access their site', async () => {
    const db = createDb([{ ownerId: 'hosted-owner' }]);
    const allowed = await userCanAccessSite(db as never, 'hosted-owner', 'site-1', HOSTED_OWNER);
    expect(allowed).toBe(true);
  });

  it('lets a fleet operator access any site', async () => {
    const db = createDb([]);
    const allowed = await userCanAccessSite(db as never, 'op-1', 'site-any', FLEET_OPERATOR);
    expect(allowed).toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });
});
