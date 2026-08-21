/**
 * Chargeable event catalog for the Governed Agent Run PPE actor (GAP-431).
 *
 * Apify's pay-per-event pricing is NOT declared in `.actor/actor.json` -- there
 * is no `pricingInfos` field there (verified against docs.apify.com July 2026;
 * see the PR body / README for the citation). Pricing lives out-of-repo, set
 * via the Apify Console (Actor -> Monetization) or a `PUT /v2/acts/{actorId}`
 * API call, keyed by these exact event-name strings. This file is the single
 * in-repo source of truth for that event catalog: the code below calls
 * `Actor.charge({ eventName })` with these `name` values, and whoever applies
 * pricing in Console/API must register the same names with these prices so
 * the two stay in lockstep (Apify does not validate this at build time --
 * an unregistered event name silently charges $0).
 *
 * Prices are the owner-ruled 2026-07-26 launch prices (value-anchored, not
 * yet market-validated). On adoption, add this channel to
 * `business/offerings-canonical.md` in the revealui-jv repo -- that file is
 * the canonical pricing source of truth and does not yet list Apify PPE
 * pricing as of this PR.
 *
 * To change a price: edit the value below, then re-apply it via Console or
 * the `PUT /v2/acts/{actorId}` body documented in README.md -- the actor code
 * never needs to change for a price-only adjustment.
 */
export interface ChargeableEvent {
  /** Event name string passed to `Actor.charge({ eventName })`. */
  readonly name: string;
  /** Human-readable title shown in the Apify billing UI. */
  readonly title: string;
  /** What triggers this charge, shown in the Apify billing UI. */
  readonly description: string;
  /** Price in USD, applied via Console/API (not read by the actor at runtime). */
  readonly priceUsd: number;
}

export const CHARGEABLE_EVENTS = {
  governedAction: {
    name: 'governed-action',
    title: 'Governed action',
    description: 'One model call or tool call executed and recorded into the signed action log.',
    priceUsd: 0.02,
  },
  runCompleted: {
    name: 'run-completed',
    title: 'Governed run completed',
    description:
      'A governed agent run finished and a signed, offline-verifiable receipt was produced.',
    priceUsd: 0.08,
  },
  receiptVerification: {
    name: 'receipt-verification',
    title: 'Receipt verification',
    description:
      'A previously issued receipt was checked for validity. $0.00001 per run (Apify Console minimum; $0.00 is not an option).',
    priceUsd: 0.00001,
  },
} as const satisfies Record<string, ChargeableEvent>;
