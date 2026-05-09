/**
 * RevealCoin parking flag.
 *
 * Per the 2026-05-08 charge-readiness audit (`~/revfleet/.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md`,
 * §5 Phase 4 Item 0.3), `apps/revealcoin/` is PARKED until 2026-Q4. Resuming
 * the dashboard requires ALL of:
 *
 *   1. On-chain Anchor vesting program built + audited (Trail of Bits / OtterSec).
 *   2. Hardware-wallet-backed mint authority via 3-of-5 Squads multisig.
 *   3. Token classification opinion from securities counsel (US + EU).
 *   4. Adversarial test suite (replay, race, property-based token math).
 *   5. Bounded `RVC_INITIAL_PRICE` with min/max + dual-confirm env vars.
 *
 * While parked, every route renders `ParkedPage` (a single notice that names
 * the parking decision + links to the broader fleet roadmap). The historical
 * components and routes (`HomePage`, `TokenomicsPage`, `ExplorerPage`,
 * `WhitepaperPage`) are kept on disk so un-parking is a single-flag flip
 * once the prerequisites land — no rebuild from scratch needed.
 *
 * To un-park: set this flag to `false`, ship a separate PR that re-points
 * `App.tsx` route registrations at the original page components, and
 * remove the parked notice from the navigation/footer.
 */
export const REVEALCOIN_PARKED = true as const;

/**
 * The Q4-2026 anchor date the parking notice quotes. Update only when the
 * resumption plan moves; do not silently push back without a corresponding
 * audit-doc update.
 */
export const REVEALCOIN_RESUME_TARGET = '2026-Q4';
