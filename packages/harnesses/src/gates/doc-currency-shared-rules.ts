/**
 * doc-currency-shared-rules — the fleet-fact DETECTION tuples shared by the
 * doc-currency stale-fact scanners.
 *
 * Control layer (GAP-408): this module is the single editable source for the
 * SHARED_FLEET_RULES detection data (id + anyOf + unlessLineHas). The public
 * revealui `scripts/validate/doc-currency.ts` and the private
 * `.jv/scripts/doc-currency-check.ts` both load this module at runtime and
 * attach their own repo-appropriate MESSAGES keyed by rule id — messages are
 * not shared, only detection is.
 *
 * Privacy carve-out (per .jv `.claude/rules/doc-currency.md` cross-scanner
 * lockstep section): the `retired-suite-path` rule below carries only the
 * username-free `~/suite/` form. The absolute (`/home/<user>/suite/`) and
 * WSL-UNC forms embed a developer username, which the public repo's
 * `gate:security` local-path-leak check forbids — those two terms stay a
 * PRIVATE .jv-only overlay merged onto this rule at load time, never here.
 * Likewise `boi-mandatory` (internal legal/business posture, no public
 * surface) is not in this module at all — it stays wholly .jv-only.
 */

export interface DetectionRule {
  id: string;
  /** A occurrence is a candidate hit if it contains (case-insensitive) ANY of these. */
  anyOf: readonly string[];
  /** …UNLESS the same occurrence also contains ANY of these exoneration markers. */
  unlessLineHas: readonly string[];
}

/**
 * Shared past-tense / correction markers — if any appears alongside a banned
 * term, the term is being discussed as past/known, not asserted as current.
 */
export const COMMON_EXON: readonly string[] = [
  'cancel',
  'dropped',
  'drop ',
  'remov',
  'retir',
  'superseded',
  'supersede',
  'deprecat',
  'former',
  'historical',
  'history',
  'archive',
  'legacy',
  'no longer',
  'not required',
  'not used',
  'instead',
  'migrat',
  'replaced',
  'sunset',
  'void',
  'was ',
  'were ',
  'used to',
  'transitional',
  'exempt',
  '→',
  '->',
  '~~',
  'do not',
  "don't",
  'never',
  'pending',
  'not yet',
  'will be',
  'once ',
  'before ',
  'n/a',
  'obsolete',
  'phased out',
  'wind down',
  'winding down',
  'decommiss',
];

/**
 * Bespoke exoneration list for `stripe-not-live-claim` — NOT `COMMON_EXON`,
 * whose "not yet" / "pending" / "before" / "will be" markers would exonerate
 * the exact phrasing a stale not-flipped claim uses. This list exonerates
 * flip-done / rollback / past-tense markers instead.
 */
export const STRIPE_LIVE_EXON: readonly string[] = [
  'flipped 2026-06-26',
  'flipped on 2026-06-26',
  'executed 2026-06-26',
  'was flipped',
  'has been flipped',
  'now flipped',
  'now live',
  'went live',
  'rollback',
  'roll back',
  '~~',
  'previously',
  'used to',
  'formerly',
  'no longer',
  'historical',
  'archive',
  'superseded',
  'retired',
  'was ',
  'were ',
];

/**
 * SHARED FLEET FACTS — detection tuples only (no messages; those stay
 * per-repo). Order is the canonical order both scanners render rules in.
 */
export const SHARED_DETECTION_RULES: readonly DetectionRule[] = [
  {
    id: 'revealcoin-as-current',
    anyOf: ['revealcoin', 'rvc ', '$rvc', '$rvui', 'rvui-payment', 'rvui payment'],
    unlessLineHas: [...COMMON_EXON, 'cancelled 2026-05-29', 'shelved'],
  },
  {
    id: 'railway-as-current',
    anyOf: ['railway'],
    unlessLineHas: [...COMMON_EXON, 'fly.io', 'fly machine', 'not railway'],
  },
  {
    id: 'vercel-blob-as-current',
    anyOf: ['blob_read_write_token', 'vercel blob', '@vercel/blob', 'vercel/postgres'],
    unlessLineHas: [...COMMON_EXON, 'r2', 'cloudflare'],
  },
  {
    id: 'supabase-as-current',
    anyOf: ['supabase'],
    unlessLineHas: [
      ...COMMON_EXON,
      'neon',
      'electric',
      'removal',
      'boundary',
      'rag',
      'dual-db',
      'dual db',
    ],
  },
  {
    // Inverse of a retired `stripe-live-claim`: Stripe live mode was flipped
    // ON 2026-06-26, so a doc still asserting Stripe is NOT flipped /
    // test-mode AS CURRENT is the drift. Uses STRIPE_LIVE_EXON, not
    // COMMON_EXON — see that constant's doc comment for why.
    id: 'stripe-not-live-claim',
    anyOf: [
      'stripe live mode is not flipped',
      'stripe live-mode is not flipped',
      'stripe live-flip is not',
      'stripe live-flip has not',
      'stripe live-flip is owner-gated and has not',
      'stripe is not flipped',
      'stripe not flipped',
      'stripe live keys are not flipped',
      'stripe live mode is still false',
      'stripe live-mode is still false',
      'stripe_live_mode is still false',
      'payments are not live',
      'billing is not live',
      'stripe live mode has not executed',
      'stripe live-flip has not executed',
      'flip stripe live mode',
      'flip stripe live-mode',
    ],
    unlessLineHas: STRIPE_LIVE_EXON,
  },
  {
    id: 'forge-tier-name',
    anyOf: [
      'forge tier',
      'forge perpetual',
      'forge (enterprise)',
      'enterprise (forge)',
      '"forge" tier',
    ],
    unlessLineHas: [...COMMON_EXON, 'renamed', 'now enterprise'],
  },
  {
    // Pricing-truth guard. RevealUI Max is $299/mo; the retired $149/mo Max
    // figure presented as current is stale drift. Enumerated tier+price
    // phrasings (like stripe-not-live-claim) rather than a bare '$149',
    // because $149 is a legitimate current figure elsewhere (the Pro
    // Perpetual support renewal is $149/yr) — anchoring the Max name beside
    // the price avoids flagging those.
    id: 'max-price-stale',
    anyOf: [
      'max $149',
      'max: $149',
      'max - $149',
      'max — $149',
      'max plan $149',
      'max tier $149',
      'max is $149',
      'max at $149',
      'max ($149',
      'revealui max $149',
      '| max | $149',
      '$149/mo max',
      '$149/month max',
      '$149 for max',
      '$149/mo for max',
      '$149/month for max',
    ],
    unlessLineHas: [...COMMON_EXON, '$299', '299/mo', 'perpetual', 'renewal'],
  },
  {
    // Username-free form only — see the file header's privacy carve-out.
    id: 'retired-suite-path',
    anyOf: ['~/suite/'],
    unlessLineHas: [...COMMON_EXON, 'now ~/revfleet', 'renamed'],
  },
];
