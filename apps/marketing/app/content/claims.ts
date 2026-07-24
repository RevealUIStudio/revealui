// Copy for /claims (ClaimsPage.tsx), the public claims ledger.
//
// Locked design: frontend-excellence Phase 5, Fable ruling 2026-07-16. The
// page renders the claims-evidence index (claims-evidence.ts) directly, so
// every prose sentence written here is itself indexed there too. The page
// proves itself, the same way it proves every other page on the site.

export const CLAIMS_HERO = {
  eyebrow: 'Public proof',
  h1: 'The claims ledger',
  subtitle:
    'Every sentence on this site that makes a claim about the product carries an entry below. Each one links to the code, the command, or the page that proves it.',
} as const;

export const CLAIMS_COUNTS_LABELS = {
  entriesLabel: 'indexed claims',
  filesLabel: 'covered files',
} as const;

// GAP-355 Stage 3 flagship claim: the audit log is signed with a key anyone
// can check, and verifying a record needs no secret of ours. Scoped to the
// audit log table (not a universal "every agent action" inventory claim).
// Stage 5+6 add agent tool/task receipts and pre-authorize on wired paths;
// residual surfaces stay out of this sentence. Heading under prose threshold.
export const CLAIMS_SIGNED_LEDGER_NOTE = {
  heading: 'Checkable by design',
  body: 'Every action in the audit log is signed with a key you can check yourself. Verifying a record does not require our secret.',
} as const;

// GAP-355 Stage 4 S4-6: lift the "receipt you hold" embargo only for Max+
// root delivery. Free/Pro keep row signing; Max downloads Merkle roots and
// verifies them offline. Verification itself is never a paid product.
export const CLAIMS_RECEIPT_HOLD_NOTE = {
  heading: 'Hold a root on Max',
  body: 'On Max, the worker seals ranges of your signed audit log into Merkle roots you can download. You verify those roots offline with the published public key, without calling us. Free and Pro still get a signed log. Root delivery is Max. Checking a receipt is free either way.',
} as const;

// GAP-355 Stage 6 S6-6: Stage 6 build is green on test (principal +
// authorizeAgentTool + stream/dispatch wrap + authorize CI checklist).
// Scoped honesty: stream and ticket dispatch pre-authorize tools; governed
// MCP keeps its role/tier matrix. Not a universal inventory claim.
export const CLAIMS_AGENT_GOVERNANCE_NOTE = {
  heading: 'Agent tools are pre-authorized',
  body: 'On stream and ticket dispatch, tools run only after a principal check. Denials leave a receipt and do not execute. Governed MCP keeps its own role and tier gate.',
} as const;

export const CLAIMS_LEDGER_INTRO =
  'The ledger below is grouped by page, starting with the homepage and moving outward through the site.' as const;

export interface KindLegendEntry {
  readonly kind: 'code' | 'command' | 'url' | 'metric' | 'test';
  readonly label: string;
  readonly description: string;
}

export const CLAIMS_KIND_LEGEND: readonly KindLegendEntry[] = [
  {
    kind: 'code',
    label: 'Code',
    description: 'A file or directory in the public repository that implements the claim.',
  },
  {
    kind: 'command',
    label: 'Command',
    description: 'A command you can run yourself to reproduce the claim.',
  },
  {
    kind: 'url',
    label: 'URL',
    description: 'A live page or endpoint that demonstrates the claim in production.',
  },
  {
    kind: 'metric',
    label: 'Metric',
    description: 'A number pinned to the codebase and checked by the claim-drift gate.',
  },
  {
    kind: 'test',
    label: 'Test',
    description: 'A named, non-skipped test in the repository that proves the claim in code.',
  },
] as const;

export const CLAIMS_HONESTY_RAILS_SECTION = {
  heading: 'What this page checks',
  intro:
    'The validator that generates this page runs on every pull request and checks the following.',
  checks: [
    'Every covered sentence on the site carries a matching entry in this index.',
    "Each entry's text still matches the live copy, word for word.",
    'Every code path an entry cites still exists in the tracked repository.',
  ],
  notCheckedHeading: 'What this page does not check',
  doesNotCheck: [
    'The gate does not check that the cited code actually does what the sentence claims.',
    'That judgment is a human review layer, not an automated one.',
  ],
} as const;
