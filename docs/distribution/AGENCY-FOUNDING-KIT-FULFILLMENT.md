# Agency Founding Kit fulfillment (GAP-448)

Operator runbook after a buyer completes **Agency Perpetual** checkout
(`POST /api/billing/checkout-perpetual` with `tier: max`). Automated Stripe
path already mints the JWT (`maxSites: 10`) and emails the key. This document
is the remaining **kit stamp** step until a worker job exists.

## Automated today

1. Stripe Checkout (authenticated) for Agency Perpetual ($8,499).
2. Webhook `checkout.session.completed` + `mode=payment` + `tier=max` →
   `mintLicenseKey` with `perpetual: true`, `maxSites: 10`, `maxUsers: 100`.
3. `sendPerpetualLicenseActivatedEmail` names the Agency Founding Kit and
   includes the license key + `/account/license` link.
4. Optional GitHub team provision when `github_username` metadata is set.

## Operator stamp (RevForge)

From a machine with revvault and revealui signer keys:

```bash
revvault export-env -- \
  ./stamp.sh \
    --company "Buyer Co" \
    --slug "buyer-co" \
    --email "buyer@example.com" \
    --password '<temp-admin-password>' \
    --brand "#1a56db" \
    --output ../buyer-co-fleet \
    --license-tier max \
    --license-perpetual
# maxSites 10 is applied automatically for max + perpetual (GAP-448).
# Override: --license-max-sites N
```

Deliver:

- Private GitHub invite (or kit archive) for the stamped output
- Confirm buyer has the emailed JWT as `REVEALUI_LICENSE_KEY`
- Buyer runs `bin/revvault-bootstrap.sh` + `docker compose up` per kit docs

## Not automated yet (Phase 2 residual)

- Payment webhook → async stamp job → download URL / email of kit zip
- Unauthenticated Payment Link for $8,499 (prefer keep auth checkout)

## Marketing

- Public surface: `https://revealui.com/pricing#agency-founding-kit`
- Self-host Free tier banner deep-links that anchor
