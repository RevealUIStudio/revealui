# Owner launch checklist (GAP-434)

**Merchant re-rule 2026-08-02:** Stripe **Payment Link** (path C) now.
Polar deferred. Stripe Managed Payments (path D) is a later MoR upgrade on
the same Payment Link / Checkout surface.

## Status (2026-08-03)

| Item | State |
|------|--------|
| Kit content | revealui `test` `examples/starter-kit` |
| Private seed | `d9b6f2c` on `RevealUIStudio/revealui-starter-kit` |
| Marketing listing | `/pricing#starter-kit` (content-only $299) |
| **Stripe product** | **live** `prod_V01FoZi9YbgZw9` |
| **Stripe price** | **live** `price_1U01D1Jz64n6uEibtamJHxkU` ($299 one-time) |
| **Payment Link** | **live** `https://buy.stripe.com/dRmeVegcH1AM2mmdbsa3u03` (`plink_1U01D2Jz64n6uEibnSK45nuS`) |
| Public Starter Kit checkout | **Removed** from `SITE.urls`. Do not restore a public Stripe checkout or Buy CTA. Not a catalog SKU. |
| Fulfillment | **manual**: GitHub invite + Skool buyer invite (launch volume). Skool: https://www.skool.com/@joshua-vaughn-3634 (invite-only). Substack broadcast: https://substack.com/@revealuistudio (not support home). |
| First-month Pro coupon | **seed script ready** (§4); run once on live key |
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

Starter Kit is not a public catalog SKU. Do not restore `SITE.urls.starterKitCheckout`
or a public Buy / Stripe checkout CTA. Studio fulfillment stays owner-only.

## 4. Stripe first-month-of-Pro coupon (owner, one command)

Idempotent seeder (preferred over raw CLI):

```bash
export STRIPE_SECRET_KEY="$(revvault get --full revealui/prod/stripe/secret-key)"
pnpm stripe:seed:starter-kit-coupon -- --dry-run   # preview
pnpm stripe:seed:starter-kit-coupon                # create if missing
pnpm stripe:seed:starter-kit-coupon -- --check     # exit 1 if drift
```

Creates coupon `starter_kit_pro_month_1` (100% once) + promo `STARTERKITPRO1`.
Email **STARTERKITPRO1** with the GitHub invite. Constants live in
`scripts/setup/starter-kit-pro-coupon.ts` (do not invent alternate ids).

Raw Stripe CLI equivalent (only if seeder unavailable; Stripe API 2025+ nested promotion):

```bash
export STRIPE_API_KEY="$(revvault get --full revealui/prod/stripe/secret-key)"
stripe coupons create --duration=once --percent-off=100 \
  --name="Starter Kit first Pro month" --id="starter_kit_pro_month_1"
# Do NOT pass top-level --coupon (unknown parameter on current API).
stripe promotion_codes create \
  --code=STARTERKITPRO1 \
  -d "promotion[type]=coupon" \
  -d "promotion[coupon]=starter_kit_pro_month_1"
```

## 5. Manual fulfillment SOP (every sale until automated)

1. Stripe Dashboard → Payments → new $299 Starter Kit payment (or email).
2. Buyer email from receipt.
3. GitHub: invite buyer as **read** collaborator on
   `RevealUIStudio/revealui-starter-kit`.
4. Skool: invite buyer via https://www.skool.com/@joshua-vaughn-3634 (invite-only;
   no public marketing join CTA). Substack is not the support home.
5. Reply with invite notes + optional `STARTERKITPRO1` (when created).

Target: within **one business day** (matches Payment Link confirmation copy).

## 6. Free / low-cost distribution (Stripe family)

One link: `https://buy.stripe.com/dRmeVegcH1AM2mmdbsa3u03`

- `/pricing#starter-kit` (after merge/deploy)
- LinkedIn / Substack (https://substack.com/@revealuistudio) / optional X when the handle is live
- Product Hunt / Show HN / Indie Hackers
- Technical post (receipt recipes) with soft CTA
- GitHub monorepo docs pointer to pricing section

Do not dual-list Polar or Lemon Squeezy storefronts.

## 7. Acceptance

1. Smoke purchase (owner card OK; refund after).
2. Manual GitHub + Skool invite works.
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
