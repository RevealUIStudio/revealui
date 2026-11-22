import { describe, expect, it } from 'vitest';
import { findAdminRoleLiterals } from '../admin-role-literal.js';

describe('findAdminRoleLiterals', () => {
  it('flags role === admin and role !== admin', () => {
    const src = `
      if (user.role === 'admin') return true;
      if (authSession.user.role !== 'admin') return false;
    `;
    expect(findAdminRoleLiterals(src, 'fixture.ts')).toHaveLength(2);
  });

  it('flags the literal on the left and loose equality', () => {
    const src = `
      if ('admin' === user.role) return true;
      if (user.role != 'admin') return false;
    `;
    expect(findAdminRoleLiterals(src, 'fixture.ts')).toHaveLength(2);
  });

  it('flags an optional role access and a role element access', () => {
    const src = `
      const ok = session?.user?.role === 'admin';
      const also = user?.['role'] !== 'admin';
    `;
    expect(findAdminRoleLiterals(src, 'fixture.ts')).toHaveLength(2);
  });

  it('does not flag owner checks, includes(), or a bare string', () => {
    const src = `
      // role === 'admin' in a comment is not code
      const label = 'admin';
      if (user.role === 'owner') return true;
      if (roles.includes('admin')) return true;
    `;
    expect(findAdminRoleLiterals(src, 'fixture.ts')).toHaveLength(0);
  });
});
