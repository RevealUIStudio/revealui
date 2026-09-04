import { describe, expect, it } from 'vitest';
import { shouldNamespaceKeys, tenantNaturalKey } from '../tenant-key.js';

describe('tenantNaturalKey', () => {
  it('prefixes a client key', () => {
    expect(tenantNaturalKey('acct_1', 'app/src/foo.ts')).toBe('tenant:acct_1:app/src/foo.ts');
  });

  it('is idempotent (no double-prefix)', () => {
    const once = tenantNaturalKey('acct_1', 'app/src/foo.ts');
    expect(tenantNaturalKey('acct_1', once)).toBe(once);
  });

  it('does not treat another tenant prefix as already-namespaced', () => {
    expect(tenantNaturalKey('acct_1', 'tenant:acct_2:path')).toBe(
      'tenant:acct_1:tenant:acct_2:path',
    );
  });
});

describe('shouldNamespaceKeys', () => {
  it('namespaces hosted non-operators only', () => {
    expect(shouldNamespaceKeys({ trustBoundary: 'hosted', isFleetOperator: false })).toBe(true);
    expect(shouldNamespaceKeys({ trustBoundary: 'hosted', isFleetOperator: true })).toBe(false);
    expect(shouldNamespaceKeys({ trustBoundary: 'studio-local', isFleetOperator: false })).toBe(
      false,
    );
  });
});
