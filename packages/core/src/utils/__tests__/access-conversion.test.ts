import { describe, expect, it } from 'vitest';
import {
  combineRevealUIAccessRules,
  convertToRevealUIAccessRule,
  createEnhancedAccessRule,
  createRevealUIAccessRule,
  evaluateRevealUIAccessRule,
} from '../access-conversion.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    user: undefined,
    tenant: undefined,
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal context shape
  } as any;
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: 'user-1', roles: [], ...overrides };
}

// ---------------------------------------------------------------------------
// Tests  -  createRevealUIAccessRule
// ---------------------------------------------------------------------------
describe('createRevealUIAccessRule', () => {
  it('creates rule with all options', () => {
    const condition = () => true;
    const rule = createRevealUIAccessRule({
      tenant: 't-1',
      user: 'u-1',
      permissions: ['read'],
      condition,
    });

    expect(rule.tenant).toBe('t-1');
    expect(rule.user).toBe('u-1');
    expect(rule.permissions).toEqual(['read']);
    expect(rule.condition).toBe(condition);
  });

  it('creates rule with no options', () => {
    const rule = createRevealUIAccessRule({});

    expect(rule.tenant).toBeUndefined();
    expect(rule.user).toBeUndefined();
    expect(rule.permissions).toBeUndefined();
    expect(rule.condition).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests  -  convertToRevealUIAccessRule
// ---------------------------------------------------------------------------
describe('convertToRevealUIAccessRule', () => {
  it('attaches permissions and a condition', () => {
    const rule = convertToRevealUIAccessRule(['read', 'update']);

    expect(rule.permissions).toEqual(['read', 'update']);
    expect(rule.condition).toBeTypeOf('function');
  });

  it('condition returns false when no user', () => {
    const rule = convertToRevealUIAccessRule(['read']);
    const result = rule.condition!(makeContext());

    expect(result).toBe(false);
  });

  it('condition returns false when user lacks permissions', () => {
    const rule = convertToRevealUIAccessRule(['update']);
    const result = rule.condition!(makeContext({ user: makeUser({ roles: ['read'] }) }));

    expect(result).toBe(false);
  });

  it('condition returns true when user has required permissions', () => {
    const rule = convertToRevealUIAccessRule(['read']);
    const result = rule.condition!(makeContext({ user: makeUser({ roles: ['read', 'update'] }) }));

    expect(result).toBe(true);
  });

  it('condition returns true for admin role', () => {
    const rule = convertToRevealUIAccessRule(['read', 'update', 'delete']);
    const result = rule.condition!(makeContext({ user: makeUser({ roles: ['admin'] }) }));

    expect(result).toBe(true);
  });

  it('condition returns true for superAdmin', () => {
    const rule = convertToRevealUIAccessRule(['read', 'update', 'delete']);
    const result = rule.condition!(
      makeContext({ user: makeUser({ revealUI: { isSuperAdmin: true } }) }),
    );

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  createEnhancedAccessRule
// ---------------------------------------------------------------------------
describe('createEnhancedAccessRule', () => {
  it('grants access to superAdmin by default', () => {
    const rule = createEnhancedAccessRule({ permissions: ['delete'] });
    const result = rule.condition!(
      makeContext({ user: makeUser({ revealUI: { isSuperAdmin: true } }) }),
    );

    expect(result).toBe(true);
  });

  it('blocks superAdmin when allowSuperAdmin is false', () => {
    const rule = createEnhancedAccessRule({ permissions: ['delete'], allowSuperAdmin: false });
    const result = rule.condition!(
      makeContext({ user: makeUser({ revealUI: { isSuperAdmin: true } }) }),
    );

    // Falls through to permission check  -  superAdmin user has no roles
    expect(result).toBe(false);
  });

  it('runs custom condition before permission check', () => {
    const rule = createEnhancedAccessRule({
      permissions: ['read'],
      allowSuperAdmin: false,
      customCondition: () => 'Custom denial',
    });
    const result = rule.condition!(makeContext({ user: makeUser({ roles: ['read'] }) }));

    expect(result).toBe('Custom denial');
  });

  it('continues to permissions when custom condition returns true', () => {
    const rule = createEnhancedAccessRule({
      permissions: ['read'],
      allowSuperAdmin: false,
      customCondition: () => true,
    });
    const result = rule.condition!(makeContext({ user: makeUser({ roles: ['read'] }) }));

    expect(result).toBe(true);
  });

  it('enforces tenant scoping', () => {
    const rule = createEnhancedAccessRule({
      permissions: ['read'],
      tenantScoped: true,
      allowSuperAdmin: false,
    });
    const result = rule.condition!(
      makeContext({
        user: makeUser({ roles: ['read'], tenants: ['t-1'] }),
        tenant: { id: 't-2' },
      }),
    );

    expect(result).toBe(false);
  });

  it('allows user in correct tenant', () => {
    const rule = createEnhancedAccessRule({
      permissions: ['read'],
      tenantScoped: true,
      allowSuperAdmin: false,
    });
    const result = rule.condition!(
      makeContext({
        user: makeUser({ roles: ['read'], tenants: ['t-1'] }),
        tenant: { id: 't-1' },
      }),
    );

    expect(result).toBe(true);
  });

  it('returns false when no user', () => {
    const rule = createEnhancedAccessRule({
      permissions: ['read'],
      allowSuperAdmin: false,
    });
    const result = rule.condition!(makeContext());

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  evaluateRevealUIAccessRule
// ---------------------------------------------------------------------------
describe('evaluateRevealUIAccessRule', () => {
  it('returns true for empty rule', () => {
    const rule = createRevealUIAccessRule({});
    const result = evaluateRevealUIAccessRule(rule, makeContext());

    expect(result).toBe(true);
  });

  it('rejects when tenant does not match', () => {
    const rule = createRevealUIAccessRule({ tenant: 't-1' });
    const result = evaluateRevealUIAccessRule(rule, makeContext({ tenant: { id: 't-2' } }));

    expect(result).toBe(false);
  });

  it('accepts when tenant matches', () => {
    const rule = createRevealUIAccessRule({ tenant: 't-1' });
    const result = evaluateRevealUIAccessRule(rule, makeContext({ tenant: { id: 't-1' } }));

    expect(result).toBe(true);
  });

  it('rejects when user does not match', () => {
    const rule = createRevealUIAccessRule({ user: 'u-1' });
    const result = evaluateRevealUIAccessRule(rule, makeContext({ user: makeUser({ id: 'u-2' }) }));

    expect(result).toBe(false);
  });

  it('accepts when user matches', () => {
    const rule = createRevealUIAccessRule({ user: 'u-1' });
    const result = evaluateRevealUIAccessRule(rule, makeContext({ user: makeUser({ id: 'u-1' }) }));

    expect(result).toBe(true);
  });

  it('rejects when user lacks permissions', () => {
    const rule = createRevealUIAccessRule({ permissions: ['delete'] });
    const result = evaluateRevealUIAccessRule(
      rule,
      makeContext({ user: makeUser({ roles: ['read'] }) }),
    );

    expect(result).toBe(false);
  });

  it('accepts when user has permissions', () => {
    const rule = createRevealUIAccessRule({ permissions: ['read'] });
    const result = evaluateRevealUIAccessRule(
      rule,
      makeContext({ user: makeUser({ roles: ['read'] }) }),
    );

    expect(result).toBe(true);
  });

  it('accepts admin for any permission', () => {
    const rule = createRevealUIAccessRule({ permissions: ['delete', 'publish'] });
    const result = evaluateRevealUIAccessRule(
      rule,
      makeContext({ user: makeUser({ roles: ['admin'] }) }),
    );

    expect(result).toBe(true);
  });

  it('accepts superAdmin for any permission', () => {
    const rule = createRevealUIAccessRule({ permissions: ['delete'] });
    const result = evaluateRevealUIAccessRule(
      rule,
      makeContext({ user: makeUser({ revealUI: { isSuperAdmin: true } }) }),
    );

    expect(result).toBe(true);
  });

  it('rejects when no user and permissions required', () => {
    const rule = createRevealUIAccessRule({ permissions: ['read'] });
    const result = evaluateRevealUIAccessRule(rule, makeContext());

    expect(result).toBe(false);
  });

  it('delegates to condition function', () => {
    const rule = createRevealUIAccessRule({ condition: () => 'where clause' });
    const result = evaluateRevealUIAccessRule(rule, makeContext());

    expect(result).toBe('where clause');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  combineRevealUIAccessRules
// ---------------------------------------------------------------------------
describe('combineRevealUIAccessRules', () => {
  it('OR: returns true if any rule passes', () => {
    const rules = [
      createRevealUIAccessRule({ user: 'u-1' }),
      createRevealUIAccessRule({ user: 'u-2' }),
    ];
    const combined = combineRevealUIAccessRules(rules, 'OR');
    const result = evaluateRevealUIAccessRule(
      combined,
      makeContext({ user: makeUser({ id: 'u-2' }) }),
    );

    expect(result).toBe(true);
  });

  it('OR: returns false if no rule passes', () => {
    const rules = [
      createRevealUIAccessRule({ user: 'u-1' }),
      createRevealUIAccessRule({ user: 'u-2' }),
    ];
    const combined = combineRevealUIAccessRules(rules, 'OR');
    const result = evaluateRevealUIAccessRule(
      combined,
      makeContext({ user: makeUser({ id: 'u-3' }) }),
    );

    expect(result).toBe(false);
  });

  it('AND: returns true only if all rules pass', () => {
    const rules = [
      createRevealUIAccessRule({ tenant: 't-1' }),
      createRevealUIAccessRule({ permissions: ['read'] }),
    ];
    const combined = combineRevealUIAccessRules(rules, 'AND');
    const result = evaluateRevealUIAccessRule(
      combined,
      makeContext({
        tenant: { id: 't-1' },
        user: makeUser({ roles: ['read'] }),
      }),
    );

    expect(result).toBe(true);
  });

  it('AND: returns false if any rule fails', () => {
    const rules = [
      createRevealUIAccessRule({ tenant: 't-1' }),
      createRevealUIAccessRule({ permissions: ['delete'] }),
    ];
    const combined = combineRevealUIAccessRules(rules, 'AND');
    const result = evaluateRevealUIAccessRule(
      combined,
      makeContext({
        tenant: { id: 't-1' },
        user: makeUser({ roles: ['read'] }),
      }),
    );

    expect(result).toBe(false);
  });

  it('defaults to OR operator', () => {
    const rules = [
      createRevealUIAccessRule({ user: 'u-1' }),
      createRevealUIAccessRule({ user: 'u-2' }),
    ];
    const combined = combineRevealUIAccessRules(rules);
    const result = evaluateRevealUIAccessRule(
      combined,
      makeContext({ user: makeUser({ id: 'u-2' }) }),
    );

    expect(result).toBe(true);
  });
});
