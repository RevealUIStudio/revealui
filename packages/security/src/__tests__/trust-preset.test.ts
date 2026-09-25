/**
 * Spec 03 slice 1: low_trust_review preset resolution.
 *
 * Narrowest preset wins. A low_trust_review result must bind to exactly one
 * server-side ReviewScope in the run account. Missing, ambiguous, and
 * cross-account scopes fail closed. Client layers may only narrow.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  configureLowTrustLimits,
  DEFAULT_LOW_TRUST_MAX_OUTPUT_BYTES,
  EXTERNAL_TRUST_CHANNEL_SOURCES,
  getLowTrustLimits,
  isExternalTrustChannel,
  LOW_TRUST_DENIED_CLASSES,
  parseLowTrustMode,
  type ReviewScope,
  resetLowTrustLimits,
  resolveTrust,
} from '../trust-preset.js';

const ACCOUNT = 'acct-1';

function ticketScope(id = 'tkt-1', accountId = ACCOUNT): ReviewScope {
  return { kind: 'ticket', id, accountId };
}

describe('resolveTrust — narrowest wins', () => {
  it('defaults to standard when no layer sets a preset', () => {
    expect(resolveTrust([], { accountId: ACCOUNT })).toEqual({
      ok: true,
      trust: { preset: 'standard', scope: null, sources: [] },
    });
  });

  it('resolves low_trust_review when any layer names it', () => {
    const result = resolveTrust(
      [
        { source: 'agent', preset: 'standard', origin: 'server' },
        { source: 'project', preset: 'standard', origin: 'server' },
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: ticketScope(),
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );

    expect(result).toEqual({
      ok: true,
      trust: {
        preset: 'low_trust_review',
        scope: ticketScope(),
        sources: ['agent', 'project', 'task'],
      },
    });
  });

  it('keeps standard when every layer is standard', () => {
    const result = resolveTrust(
      [
        { source: 'agent', preset: 'standard', origin: 'server' },
        {
          source: 'task',
          preset: 'standard',
          scope: ticketScope('other', 'elsewhere'),
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );

    expect(result).toEqual({
      ok: true,
      trust: { preset: 'standard', scope: null, sources: ['agent', 'task'] },
    });
  });

  it('does not let a lower layer widen low_trust_review back to standard', () => {
    const result = resolveTrust(
      [
        {
          source: 'agent',
          preset: 'low_trust_review',
          scope: ticketScope(),
          origin: 'server',
        },
        { source: 'task', preset: 'standard', origin: 'server' },
      ],
      { accountId: ACCOUNT },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trust.preset).toBe('low_trust_review');
    expect(result.trust.scope).toEqual(ticketScope());
    expect(result.trust.sources).toEqual(['agent', 'task']);
  });

  it('accepts one server scope shared by several low_trust layers', () => {
    const scope = ticketScope();
    const result = resolveTrust(
      [
        { source: 'project', preset: 'low_trust_review', scope, origin: 'server' },
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: { ...scope },
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );

    expect(result).toEqual({
      ok: true,
      trust: {
        preset: 'low_trust_review',
        scope,
        sources: ['project', 'task'],
      },
    });
  });

  it('binds a single server scope when only one low_trust layer carries it', () => {
    const result = resolveTrust(
      [
        { source: 'agent', preset: 'low_trust_review', origin: 'server' },
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: ticketScope(),
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trust.scope).toEqual(ticketScope());
  });
});

describe('resolveTrust — fail closed', () => {
  it('fails when low_trust_review has no concrete scope', () => {
    expect(
      resolveTrust([{ source: 'task', preset: 'low_trust_review', origin: 'server' }], {
        accountId: ACCOUNT,
      }),
    ).toEqual({
      ok: false,
      reason: 'missing_scope',
      sources: ['task'],
    });
  });

  it('fails when the only scope id is blank', () => {
    const result = resolveTrust(
      [
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: { kind: 'ticket', id: '   ', accountId: ACCOUNT },
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing_scope');
  });

  it('fails when the scope account is not the run account', () => {
    const result = resolveTrust(
      [
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: ticketScope('tkt-9', 'other-acct'),
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );
    expect(result).toEqual({
      ok: false,
      reason: 'cross_account_scope',
      sources: ['task'],
    });
  });

  it('fails when the run account is blank', () => {
    const result = resolveTrust(
      [
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: ticketScope(),
          origin: 'server',
        },
      ],
      { accountId: ' ' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('cross_account_scope');
  });

  it('fails when two server scopes disagree', () => {
    const result = resolveTrust(
      [
        {
          source: 'agent',
          preset: 'low_trust_review',
          scope: ticketScope('a'),
          origin: 'server',
        },
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: ticketScope('b'),
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );
    expect(result).toEqual({
      ok: false,
      reason: 'ambiguous_scope',
      sources: ['agent', 'task'],
    });
  });

  it('prefers cross-account over ambiguity when a foreign scope is present', () => {
    const result = resolveTrust(
      [
        {
          source: 'agent',
          preset: 'low_trust_review',
          scope: ticketScope('a'),
          origin: 'server',
        },
        {
          source: 'project',
          preset: 'low_trust_review',
          scope: ticketScope('b', 'other-acct'),
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('cross_account_scope');
  });

  it('fails closed on an unknown preset', () => {
    const result = resolveTrust([{ source: 'task', preset: 'custom', origin: 'server' }], {
      accountId: ACCOUNT,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_layer');
  });

  it('fails closed on an unknown scope kind', () => {
    const result = resolveTrust(
      [
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: { kind: 'file', id: 'etc-passwd', accountId: ACCOUNT },
          origin: 'server',
        },
      ],
      { accountId: ACCOUNT },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_layer');
  });
});

describe('resolveTrust — client layers cannot set or widen', () => {
  it('ignores a client preset of standard', () => {
    const result = resolveTrust(
      [
        {
          source: 'agent',
          preset: 'low_trust_review',
          scope: ticketScope(),
          origin: 'server',
        },
        {
          source: 'task',
          preset: 'standard',
          scope: ticketScope('client-ticket', 'other-acct'),
          origin: 'client',
        },
      ],
      { accountId: ACCOUNT },
    );

    expect(result).toEqual({
      ok: true,
      trust: {
        preset: 'low_trust_review',
        scope: ticketScope(),
        sources: ['agent'],
      },
    });
  });

  it('lets a client narrow to low_trust_review but not supply the scope', () => {
    const narrowed = resolveTrust(
      [
        { source: 'task', scope: ticketScope(), origin: 'server' },
        { source: 'agent', preset: 'low_trust_review', origin: 'client' },
      ],
      { accountId: ACCOUNT },
    );
    expect(narrowed.ok).toBe(true);
    if (!narrowed.ok) return;
    expect(narrowed.trust.preset).toBe('low_trust_review');
    expect(narrowed.trust.scope).toEqual(ticketScope());
    expect(narrowed.trust.sources).toEqual(['agent']);

    const unbound = resolveTrust(
      [
        {
          source: 'task',
          preset: 'low_trust_review',
          scope: ticketScope(),
          origin: 'client',
        },
      ],
      { accountId: ACCOUNT },
    );
    expect(unbound).toEqual({
      ok: false,
      reason: 'missing_scope',
      sources: ['task'],
    });
  });
});

describe('low trust constants', () => {
  afterEach(() => {
    resetLowTrustLimits();
  });

  it('denies exec, admin-pii, network, and memory writes', () => {
    expect(LOW_TRUST_DENIED_CLASSES).toEqual(['exec', 'admin-pii', 'network', 'memory-write']);
  });

  it('defaults maxOutputBytes to 8192 and allows an override', () => {
    expect(DEFAULT_LOW_TRUST_MAX_OUTPUT_BYTES).toBe(8192);
    expect(getLowTrustLimits().maxOutputBytes).toBe(8192);
    configureLowTrustLimits({ maxOutputBytes: 128 });
    expect(getLowTrustLimits().maxOutputBytes).toBe(128);
  });

  it('parses the rollout flag and fails closed on unknown values', () => {
    expect(parseLowTrustMode(undefined)).toBe('off');
    expect(parseLowTrustMode('')).toBe('off');
    expect(parseLowTrustMode('off')).toBe('off');
    expect(parseLowTrustMode('shadow')).toBe('shadow');
    expect(parseLowTrustMode('enforce')).toBe('enforce');
    expect(parseLowTrustMode('TRUE')).toBe('enforce');
  });

  it('treats public forms, inbound email, and fork PRs as external channels', () => {
    expect(EXTERNAL_TRUST_CHANNEL_SOURCES).toEqual(['public_form', 'inbound_email', 'fork_pr']);
    expect(isExternalTrustChannel('public_form')).toBe(true);
    expect(isExternalTrustChannel('inbound_email')).toBe(true);
    expect(isExternalTrustChannel('fork_pr')).toBe(true);
    expect(isExternalTrustChannel('member')).toBe(false);
  });
});
