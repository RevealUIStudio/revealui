/**
 * Fail-closed gates for audit receipts genesis (ADR-009).
 * Kept free of @revealui/db so unit tests do not need a built package.
 */

export const GENESIS_CONFIRM = 'TRUNCATE_AUDIT_LOG_AND_AUDIT_ANCHORS';

export interface GenesisArgs {
  apply: boolean;
  attestNoPayingCustomers: boolean;
}

export function parseGenesisArgs(argv: string[]): GenesisArgs {
  return {
    apply: argv.includes('--apply'),
    attestNoPayingCustomers: argv.includes('--attest-no-paying-customers'),
  };
}

export function applyBlockedReason(args: GenesisArgs, confirm: string | undefined): string | null {
  if (!args.apply) return null;
  if (confirm !== GENESIS_CONFIRM) {
    return `refusing --apply: set AUDIT_RECEIPTS_GENESIS_CONFIRM=${GENESIS_CONFIRM}`;
  }
  if (!args.attestNoPayingCustomers) {
    return 'refusing --apply: pass --attest-no-paying-customers (ADR-009 pre-customer only)';
  }
  return null;
}
