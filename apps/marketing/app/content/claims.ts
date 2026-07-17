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

export const CLAIMS_LEDGER_INTRO =
  'The ledger below is grouped by page, starting with the homepage and moving outward through the site.' as const;

export interface KindLegendEntry {
  readonly kind: 'code' | 'command' | 'url' | 'metric';
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
