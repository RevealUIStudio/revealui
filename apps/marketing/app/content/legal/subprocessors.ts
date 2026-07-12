// Subprocessors page content. Custom shape (not LegalSection) — this page
// is a tabular registry, not prose, so it has its own schema.

export interface Subprocessor {
  readonly name: string;
  readonly role: string;
  readonly location: string;
  readonly dataCategories: readonly string[];
  readonly privacyPolicyUrl: string;
  readonly dpaUrl?: string;
  /** Month we started using this vendor, YYYY-MM. */
  readonly since: string;
}

export const SUBPROCESSORS_META = {
  title: 'Subprocessors',
  lastUpdated: 'July 11, 2026',
  intro:
    'A subprocessor is a third-party service we use to operate RevealUI on your behalf. Every entry below stores, processes, or transmits some category of customer data. The table is dated and we commit to updating it before adding a new subprocessor, not after. See the change-log at the bottom of this page.',
} as const;

/**
 * Active subprocessors as of the lastUpdated date. Each entry must be
 * accurate at the moment of publication. Changes to this list must also
 * land in CHANGELOG below within the same commit.
 */
export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    name: 'Vercel',
    role: 'Application hosting (marketing, admin, API, docs)',
    location: 'United States (primary: us-east-1)',
    dataCategories: [
      'Application traffic',
      'Build artifacts',
      'Edge logs (IP, user agent, request path)',
      'Speed Insights telemetry (anonymous)',
    ],
    privacyPolicyUrl: 'https://vercel.com/legal/privacy-policy',
    dpaUrl: 'https://vercel.com/legal/dpa',
    since: '2026-03',
  },
  {
    name: 'NeonDB',
    role: 'PostgreSQL database (primary store)',
    location: 'United States (primary: us-east-1)',
    dataCategories: ['Account records', 'License records', 'Site and content data', 'Agent memory'],
    privacyPolicyUrl: 'https://neon.tech/privacy-policy',
    dpaUrl: 'https://neon.tech/dpa',
    since: '2026-03',
  },
  {
    name: 'Cloudflare R2',
    role: 'Object storage (media uploads, generated assets)',
    location: 'United States',
    dataCategories: ['Uploaded files', 'Generated images'],
    privacyPolicyUrl: 'https://www.cloudflare.com/privacypolicy/',
    dpaUrl: 'https://www.cloudflare.com/cloudflare-customer-dpa/',
    since: '2026-05',
  },
  {
    name: 'Stripe',
    role: 'Payment processing (subscriptions, perpetual licenses, refunds)',
    location: 'United States (PCI DSS Level 1)',
    dataCategories: [
      'Billing identity (name, email, billing address)',
      'Payment method metadata',
      'Transaction records',
    ],
    privacyPolicyUrl: 'https://stripe.com/privacy',
    dpaUrl: 'https://stripe.com/legal/dpa',
    since: '2026-04',
  },
  {
    name: 'Google Workspace',
    role: 'Transactional email delivery (receipts, license keys, support)',
    location: 'United States',
    dataCategories: ['Email address', 'Message content for delivery'],
    privacyPolicyUrl: 'https://policies.google.com/privacy',
    dpaUrl: 'https://workspace.google.com/terms/dpa_terms.html',
    since: '2026-03',
  },
];

export interface ChangeLogEntry {
  readonly date: string;
  readonly summary: string;
}

/**
 * Append-only change log. Every change to SUBPROCESSORS above must add an
 * entry here in the same commit. Entries are most-recent-first.
 */
export const SUBPROCESSORS_CHANGELOG: readonly ChangeLogEntry[] = [
  {
    date: '2026-07-11',
    summary:
      "Corrected NeonDB's data categories: removed 'audit logs'. Production audit-log storage does not persist to Postgres today, so listing it as a stored data category was inaccurate.",
  },
  {
    date: '2026-05-28',
    summary:
      'Initial published list: Vercel, NeonDB, Cloudflare R2, Stripe, Google Workspace. Sentry is listed in the Privacy Policy as an anticipated subprocessor for error tracking; it will appear here once the SDK is wired and a DSN is configured.',
  },
];

export const SUBPROCESSORS_NOTES = {
  subscribeAdvice:
    'There is no subscribe-to-changes channel for this page yet. Material customers can request notification by email and we will email them when an entry is added. Watch the RevealUI repository on GitHub to receive a notification when this file changes in source.',
  contactPrefix:
    'Questions about a specific subprocessor (including its DPA, regional data handling, or sub-processors of its own) should go to ',
} as const;
