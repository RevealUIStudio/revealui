# Agency Founding Kit fulfillment (GAP-448)

Operator + automation notes after a buyer completes **Agency Perpetual**
checkout (`POST /api/billing/checkout-perpetual` with `tier: max`).

## Automated today (Phase 1 + Phase 2 P2-A)

1. Stripe Checkout (authenticated) for Agency Perpetual ($8,499).
2. Webhook `checkout.session.completed` + `mode=payment` + `tier=max` →
   `mintLicenseKey` with `perpetual: true`, `maxSites: 10`, `maxUsers: 100`.
3. `sendPerpetualLicenseActivatedEmail` names the Agency Founding Kit and
   includes the license key + `/account/license` link.
4. Optional GitHub team provision when `github_username` metadata is set.
5. **Phase 2:** enqueue durable job `kit.stamp.agency` (idempotency key
   `kit.stamp.agency:${stripeEventId}`).
6. Job builds a **thin kit package** (START-HERE.md, revforge.json, manifest)
   into `kit_fulfillments.artifact` — no private keys, no full monorepo zip.
7. Buyer receives `sendAgencyKitPackageEmail` with a signed 48h download URL:
   `GET /api/kits/agency-founding/download?token=…`
8. Optional checkout session metadata for branding:
   `company` / `kit_company`, `slug` / `kit_slug`, `brand` / `kit_brand`.

## Operator full stamp (RevForge, still available)

Thin package is enough for buyer activation with the JWT. For a full Docker
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

## Not automated yet (P2-B residual)

- Long-running worker that runs full `stamp.sh` and uploads a kit tarball to R2
- Unauthenticated Payment Link for $8,499 (prefer keep auth checkout)

## Marketing

- Public surface: `https://revealui.com/pricing#agency-founding-kit`
- Self-host Free tier banner deep-links that anchor
