import { describe, expect, it } from 'vitest';
import { checkLowTrustScope, lowTrustOutputExceedsCap } from '../low-trust-scope.js';

const trust = {
  preset: 'low_trust_review' as const,
  scope: { kind: 'ticket' as const, id: 'tkt-1', accountId: 'acct-1' },
  sources: ['task' as const],
};

describe('checkLowTrustScope', () => {
  it('confirms a loaded ticket belongs to the scope account', async () => {
    const result = await checkLowTrustScope({
      toolName: 'add_ticket_comment',
      params: {},
      trust,
      loader: { load: async () => ({ accountId: 'acct-1' }) },
    });
    expect(result).toEqual({ ok: true, targetId: 'tkt-1' });
  });

  it('denies when the loaded account differs', async () => {
    const result = await checkLowTrustScope({
      toolName: 'add_ticket_comment',
      params: { ticketId: 'tkt-1' },
      trust,
      loader: { load: async () => ({ accountId: 'other' }) },
    });
    expect(result).toEqual({ ok: false, reason: 'low_trust_out_of_scope' });
  });

  it('reads documentId for document_summarize', async () => {
    const documentTrust = {
      ...trust,
      scope: { kind: 'document' as const, id: 'doc-1', accountId: 'acct-1' },
    };
    const result = await checkLowTrustScope({
      toolName: 'document_summarize',
      params: { documentId: 'doc-1' },
      trust: documentTrust,
      loader: { load: async () => ({ accountId: 'acct-1' }) },
    });
    expect(result).toEqual({ ok: true, targetId: 'doc-1' });
  });
});

describe('lowTrustOutputExceedsCap', () => {
  it('allows 8192 bytes and refuses 8193', () => {
    expect(lowTrustOutputExceedsCap('x'.repeat(8192))).toBe(false);
    expect(lowTrustOutputExceedsCap('x'.repeat(8193))).toBe(true);
  });
});
