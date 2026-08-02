# Owner launch checklist (GAP-434)

**Merchant re-rule 2026-08-02:** Stripe **Payment Link** (path C) now.
Polar deferred. Stripe Managed Payments (path D) is a later MoR upgrade on
the same Payment Link / Checkout surface.

## Status (2026-08-02)

| Item | State |
|------|--------|
| Kit content | revealui `test` `examples/starter-kit` |
| Private seed | `d9b6f2c` on `RevealUIStudio/revealui-starter-kit` |
| Marketing listing | `/pricing#starter-kit` (content-only $299) |
| **Stripe product** | **live** `prod_V01FoZi9YbgZw9` |
| **Stripe price** | **live** `price_1U01D1Jz64n6uEibtamJHxkU` ($299 one-time) |
| **Payment Link** | **live** `https://buy.stripe.com/dRmeVegcH1AM2mmdbsa3u03` (`plink_1U01D2Jz64n6uEibnSK45nuS`) |
| `SITE.urls.starterKitCheckout` | set to Payment Link (ship in monorepo PR) |
| Fulfillment | **manual**: GitHub invite + Substack (launch volume) |
| First-month Pro coupon | not seeded yet (§4) |
| Stripe Tax | confirm `STRIPE_TAX_ENABLED=true` on prod api if selling broadly |
| Managed Payments (D) | enable in Dashboard when eligible |

## 1. Seed private buyer repo — DONE

See earlier seed notes. Re-seed via `scripts/assemble-private-seed.sh` + PR.

## 2. Branch protection — best-effort

Free private GitHub may block rulesets API. Prefer PR-only process; do not
re-enable `revealui.hooks.no-protection` for routine pushes.

## 3. Stripe Payment Link — DONE (live)

Created via Stripe CLI + `revealui/prod/stripe/secret-key` (revvault):

```text
product: prod_V01FoZi9YbgZw9  "RevealUI Starter Kit"
price:   price_1U01D1Jz64n6uEibtamJHxkU  $299 one_time USD
link:    https://buy.stripe.com/dRmeVegcH1AM2mmdbsa3u03
```

Dashboard: Products → RevealUI Starter Kit → Payment links.

After a monorepo deploy of `starterKitCheckout`, `/pricing#starter-kit`
primary CTA is **Buy the Starter Kit**.

## 4. Stripe first-month-of-Pro coupon (still owner)

```bash
export STRIPE_API_KEY="$(revvault get --full revealui/prod/stripe/secret-key)"

stripe coupons create \
  --duration=once \
  --percent-off=100 \
  --name="Starter Kit first Pro month" \
  --id="starter_kit_pro_month_1"

stripe promotion_codes create \
  --coupon=starter_kit_pro_month_1 \
  --code=STARTERKITPRO1
```

Email the code with repo invite. Optional later: auto-apply env.

## 5. Manual fulfillment SOP (every sale until automated)

1. Stripe Dashboard → Payments → new $299 Starter Kit payment (or email).
2. Buyer email from receipt.
3. GitHub: invite buyer as **read** collaborator on
   `RevealUIStudio/revealui-starter-kit`.
4. Substack: private section invite.
5. Reply with invite notes + optional `STARTERKITPRO1` (when created).

Target: within **one business day** (matches Payment Link confirmation copy).

## 6. Free / low-cost distribution (Stripe family)

One link: `https://buy.stripe.com/dRmeVegcH1AM2mmdbsa3u03`

- `/pricing#starter-kit` (after merge/deploy)
- X / LinkedIn / Substack
- Product Hunt / Show HN / Indie Hackers
- Technical post (receipt recipes) with soft CTA
- GitHub monorepo docs pointer to pricing section

Do not dual-list Polar or Lemon Squeezy storefronts.

## 7. Acceptance

1. Smoke purchase (owner card OK; refund after).
2. Manual GitHub + Substack invite works.
3. `pnpm install && pnpm test && pnpm recipe:action` on private clone.
4. Pricing CTA hits Payment Link (not mailto).
5. Record on GAP-434; close when coupon + first external sale accepted.

## 8. Later: Managed Payments (D)

When Dashboard offers Managed Payments for this account/entity, enable for
digital goods so the **same Payment Link** can run under Stripe MoR. No
marketing URL change required.

## Do not

- Claim Polar or Lemon Squeezy checkout for this kit.
- Re-open a second MoR storefront.
- Put secrets in the private seed.
