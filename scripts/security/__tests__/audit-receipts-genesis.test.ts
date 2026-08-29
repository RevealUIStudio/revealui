import { describe, expect, it } from 'vitest';
import {
  applyBlockedReason,
  GENESIS_CONFIRM,
  parseGenesisArgs,
} from '../audit-receipts-genesis-gates';

describe('audit-receipts-genesis gates (ADR-009)', () => {
  it('defaults to dry-run', () => {
    expect(parseGenesisArgs([])).toEqual({
      apply: false,
      attestNoPayingCustomers: false,
    });
  });

  it('parses apply and attest flags', () => {
    expect(parseGenesisArgs(['--apply', '--attest-no-paying-customers'])).toEqual({
      apply: true,
      attestNoPayingCustomers: true,
    });
  });

  it('allows dry-run without confirm env', () => {
    expect(applyBlockedReason(parseGenesisArgs([]), undefined)).toBeNull();
  });

  it('refuses apply without confirm env', () => {
    const reason = applyBlockedReason(parseGenesisArgs(['--apply']), undefined);
    expect(reason).toContain('AUDIT_RECEIPTS_GENESIS_CONFIRM');
    expect(reason).toContain(GENESIS_CONFIRM);
  });

  it('refuses apply without attest flag even when confirm env is set', () => {
    const reason = applyBlockedReason(parseGenesisArgs(['--apply']), GENESIS_CONFIRM);
    expect(reason).toContain('--attest-no-paying-customers');
  });

  it('allows apply when confirm env and attest flag are both set', () => {
    expect(
      applyBlockedReason(
        parseGenesisArgs(['--apply', '--attest-no-paying-customers']),
        GENESIS_CONFIRM,
      ),
    ).toBeNull();
  });
});
