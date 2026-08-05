# Agency Founding Kit fulfillment (GAP-448)

Operator + automation notes after a buyer completes **Agency Perpetual**
checkout (`POST /api/billing/checkout-perpetual` with `tier: max`).

## Automated today (Phase 1 + Phase 2 P2-A / P2-B)

1. Stripe Checkout (authenticated) for Agency Perpetual ($8,499).
2. Webhook `checkout.session.completed` + `mode=payment` + `tier=max` →
   `mintLicenseKey` with `perpetual: true`, `maxSites: 10`, `maxUsers: 100`.
3. `sendPerpetualLicenseActivatedEmail` names the Agency Founding Kit and
   includes the license key + `/account/license` link.
4. Optional GitHub team provision when `github_username` metadata is set.
5. **Phase 2:** enqueue durable job `kit.stamp.agency` (idempotency key
   `kit.stamp.agency:${stripeEventId}`).
6. Job builds the kit package (no private keys):
   - **thin (default):** START-HERE.md + revforge.json + manifest in
     `kit_fulfillments.artifact` (jsonb); download is multi-file text.
   - **full (`REVEALUI_KIT_STAMP_MODE=full`):** same files packed as `.tar.gz`,
     uploaded to R2 under `kits/{test|live}/{fulfillmentId}/…tar.gz`,
     URL stored in `kit_fulfillments.artifact_uri`. Download route redirects
     after the signed token check. Requires R2 env (same as media).
7. Buyer receives `sendAgencyKitPackageEmail` with a signed 48h download URL:
   `GET /api/kits/agency-founding/download?token=…`
8. Optional checkout session metadata for branding:
   `company` / `kit_company`, `slug` / `kit_slug`, `brand` / `kit_brand`.

### Full mode on a long worker (optional stamp.sh)

On Fly/operator hosts with a revforge checkout (not Vercel serverless):

```bash
export REVEALUI_KIT_STAMP_MODE=full
export REVEALUI_KIT_STAMP_RUN=1
export REVEALUI_REVFORGE_ROOT=/path/to/revforge
# R2_* vars required for upload
# Optional: REVEALUI_LICENSE_PUBLIC_KEY for stamp.sh bake-in
```

When stamp.sh fails or is unset, full mode still uploads the **package** tar
(config files only). Buyer JWT remains the SaaS license email (no second mint).

## Operator manual stamp (RevForge)

Thin/full package is enough for buyer activation with the JWT. For a full Docker
Fleet kit on a machine with revvault:

```bash
revvault export-env -- \
  ./stamp.sh \
    --config path/to/revforge.json \
    # or flags:
    --company "Buyer Co" \
    --slug "buyer-co" \
    --email "buyer@example.com" \
    --password '<temp-admin-password>' \
    --brand "#1a56db" \
    --output ../buyer-co-fleet \
    --license-tier max \
    --license-perpetual
# maxSites 10 is applied automatically for max + perpetual (GAP-448).
```

## Residual (gap close)

- ~~e2e test-mode purchase → mint → stamp → download dry-run (P2-T1)~~
  **DONE** — `apps/server/src/routes/__tests__/agency-founding-kit-e2e.test.ts`
  (webhook max perpetual → real JWT maxSites 10 → enqueue kit.stamp.agency →
  package download with no private key). Run:
  `pnpm exec vitest run src/routes/__tests__/agency-founding-kit-e2e.test.ts`
  from `apps/server` after workspace packages are built.
- Owner: enable `REVEALUI_KIT_STAMP_MODE=full` (+ R2) on the long worker when
  tar.gz delivery is desired in prod (thin default remains safe).
- Unauthenticated Payment Link for $8,499 (prefer keep auth checkout)
- Owner: one live test-mode purchase walk on hosted (optional beyond unit e2e)

## Marketing

- Public surface: `https://revealui.com/pricing#agency-founding-kit`
- Self-host Free tier banner deep-links that anchor
