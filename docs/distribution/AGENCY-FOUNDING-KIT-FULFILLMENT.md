# Agency Founding Kit fulfillment (GAP-448)

## Automated (P2-A on test once merged)

1. Authenticated Stripe Checkout for Agency Perpetual (`tier: max`).
2. Webhook mints Max perpetual JWT with `maxSites: 10` (`withPerpetualSiteCaps` / mint limits).
3. Activation email names the Agency Founding Kit.
4. **`kit.stamp.agency` job** enqueued (idempotent on Stripe event id):
   - Upserts `kit_fulfillments`
   - Builds **thin package** (manifest + START-HERE + revforge config) — no private keys
   - Status `ready` with artifact metadata

Env:

| Var | Default | Meaning |
|-----|---------|---------|
| `REVEALUI_KIT_STAMP_MODE` | `thin` | P2-A thin package. Set `full` to mark P2-B mode (full tarball deferred until long-running worker). |

## Operator / P2-B

Full branded kit tarball via RevForge:

```bash
revvault export-env -- \
  ./stamp.sh \
    --company "Buyer Co" \
    --slug "buyer-co" \
    --email "buyer@example.com" \
    --password '<temp>' \
    --brand "#1a56db" \
    --output ../buyer-co-fleet \
    --license-tier max \
    --license-perpetual
```

maxSites 10 applies for max+perpetual by default (revforge stamp).

## Residual

- P2-B Fly long-running stamp worker writing real object-storage tarball
- Signed download HTTP route + email with kit URI
- Test-mode e2e (checkout → fulfillment ready)
