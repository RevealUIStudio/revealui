---
title: "First-24h Pro/Max UX verification report (2026-08-20)"
description: "What was actually run for Pro/Max trial first-day / first-week UX on branch test. No invented results."
visibility: internal
status: verified
audience: maintainer
---

# First-24h Pro/Max UX verification report

**Date:** 2026-08-20
**Base branch:** `test`
**Work branch:** `cursor/first-week-pro-max-ux-6664`
**No GitHub issue is closed by this work.**

## Verdict

**First-24h UX is not guaranteed.**

Unit/integration coverage for Max-as-Pro copy, real `expiresAt` on the subscription API, billing/account trial UI, signup/pricing doors, and Stripe webhook trial emails is green. The cron day-0 / day-1 / day-7 onboarding sequence remains disarmed behind `LIFECYCLE_EMAILS_ENABLED` (documented mailbox + end-to-end delivery hold). That row is an essential SKIP. Live Stripe checkout and real inbox delivery were not exercised.

## Audit hypotheses (2026-08-19 charge-gate)

| Hypothesis | Result | Notes |
|---|---|---|
| Max copy says Pro | **Verified, fixed** | Admin billing hardcoded “Your Pro trial…” / “Your Pro features…”. Signup, welcome, `tierLabel()`, and marketing CTAs were already plan-specific. |
| `expiresAt` is weak | **Verified, fixed** | `GET /api/billing/subscription` returned `expiresAt: null` on hosted-entitlement and hosted-snapshot short-circuits even when `licenses.expiresAt` stored Stripe `trial_end`. License-row and Stripe-fallback paths were already correct. |
| Lifecycle emails disarmed | **Verified, hold kept** | Cron sequence is gated by `LIFECYCLE_EMAILS_ENABLED === 'true'`. Comments require a dedicated no-reply mailbox and an owner-run delivery check. That is a real safety hold — this change does not flip the flag. Stripe webhook emails (activated / ending / expired) are already armed and not gated. |

## Commands actually run

Environment: Node 24.13.0, pnpm 10.28.2, packages built with `pnpm turbo run build --filter='./packages/*'` (30/30).

| Command | Result |
|---|---|
| `pnpm --filter admin test` (full admin Vitest) | 2188 passed, 9 skipped, 179 files passed / 1 skipped |
| `pnpm --filter server test` (full server Vitest) | 3440 passed, 1 skipped, 217 files passed |
| `pnpm --filter marketing test` (full marketing Vitest) | 181 passed, 28 files passed |
| `pnpm exec vitest run` admin billing/welcome/trial-copy (verbose) | 17 passed |
| `pnpm exec vitest run` server billing + lifecycle + webhook-emails-trial (verbose) | 86 passed |
| `pnpm exec vitest run` SignupForm (verbose) | 6 passed |
| `pnpm exec vitest run` PricingPage + landing-honesty (verbose) | 12 passed |

No live Stripe charges. No real mail sent.

## Surfaces

| Surface | What was done | Result | Evidence |
|---|---|---|---|
| Signup / Start trial CTA (Pro) | Signup `?plan=pro` copy + route to billing upgrade | **PASS** | `SignupForm.test.tsx` — `routes an auto-verified user with ?plan=pro into the billing upgrade flow` |
| Signup / Start trial CTA (Max) | Signup `?plan=max` says Max, not Pro; routes to `?upgrade=max` | **PASS** | `SignupForm.test.tsx` — `?plan=max`; asserts “Sign up to start your free 7-day Max trial.” |
| Marketing Pro/Max Start trial doors | Pricing page trial links | **PASS** | `PricingPage.test.tsx` — `keeps Pro and Max trial CTAs on admin signup` (`/signup?plan=pro` and `?plan=max`) |
| First-run welcome after paid/trial success (Pro) | Paid-success CTAs | **PASS** | `welcome/__tests__/page.test.tsx` — license key + agent CTAs when `tier: 'pro'` and `?success=true` |
| First-run welcome (Max) | Badge must say Max, not Pro | **PASS** | `welcome/__tests__/page.test.tsx` — `labels a Max paid-success visit as Max, not Pro` |
| Trial `expiresAt` API (Pro) | Entitlements short-circuit returns stored license expiry | **PASS** | `billing.test.ts` — `surfaces license expiresAt on the entitlements short-circuit for a Pro trial` → `2026-08-27T00:00:00.000Z` |
| Trial `expiresAt` API (Max) | Same for Max; hosted graceUntil fallback; Stripe fallback | **PASS** | `billing.test.ts` — Max entitlements short-circuit; `uses hosted snapshot graceUntil as Max trial expiry`; `reconciles a Max Stripe trial` |
| Billing page during Max trial | Callout title + plan badge + Max price + Expires row | **PASS** | `billing/__tests__/page.test.tsx` — `shows Max trial expiry and Max plan, not Pro`; `$299/mo`; no “Your Pro trial” |
| Billing page during Pro trial | Pro title + Pro price | **PASS** | `billing/__tests__/page.test.tsx` — `shows Pro trial expiry with the Pro price`; `$49/mo` |
| Account license page expiry | Same `GET /subscription` `expiresAt` field; page already renders “Expires” | **PASS** (API + existing UI) | License page reads `subscription.expiresAt` (`account/license/page.tsx`). API now returns it on hosted paths. No separate license-page mount test added. |
| Stripe webhook emails (activated / ending / expired) | `sendEmail` invoked with Max labels; no transport in CI | **PASS** | `webhook-emails-trial.test.ts` — Max subjects; trial-ending includes `August 27, 2026`. Triggers: `checkout.session.completed` → `sendLicenseActivatedEmail`; `customer.subscription.trial_will_end` → `sendTrialEndingEmail`; trial→active → `sendTrialExpiredEmail`. |
| Cron day-0 / day-1 / day-7 (armed path) | Unit: `send()` invoked for Pro and Max when `enabled: true` | **PASS** (code path) | `lifecycle-emails.test.ts` — armed Max/Pro day-0; disarmed never calls transport |
| Cron day-0 / day-1 / day-7 in production | Flag still not `'true'` | **SKIP** | Documented hold in `lifecycle-emails.ts` / `.env.template` / `.env.production.example`. Owner must arm after mailbox + delivery check. Not bypassed. |
| Upgrade / convert (self-serve Pro↔Max) | Checkout + upgrade route tests; Enterprise rejected | **PASS** (unit) | `billing.test.ts` — checkout/upgrade success; `rejects unattended Enterprise subscription checkout/upgrade` |
| Converted / paid path without live Stripe | Trial-expired email + checkout mocks | **PASS** (unit) | `sendTrialExpiredEmail(..., 'max')` subject `Your RevealUI Max trial has ended`. No live card charge. |
| Cancel / expire first-week door | Billing expired copy + Max resubscribe target | **PASS** (copy + unit) | `trial-copy.test.ts` — `resubscribes Max trials to Max, not Pro`; expired message uses plan label |
| Enterprise trial still absent | Signup + marketing | **PASS** | `SignupForm.test.tsx` — no “7-day Enterprise trial”; Contact-sales copy. `PricingPage.test.tsx` — Enterprise CTA is Contact sales, no `plan=enterprise` trial. |
| Enterprise checkout still Contact sales | Billing `?upgrade=enterprise` | **PASS** | `billing/__tests__/page.test.tsx` — `parks ?upgrade=enterprise at Contact sales` → `https://revealui.com/contact` |
| Starter Kit Buy still paused | Marketing CTA | **PASS** | `PricingPage.test.tsx` — Request mailto; no `buy.stripe.com`; no “Buy the RevealUI Starter Kit” |
| Pro / Agency perpetual Buy still present | Marketing CTAs | **PASS** | `PricingPage.test.tsx` — `Buy Pro Perpetual` and `Buy Agency Perpetual` → admin license checkout |
| Live Stripe 7-day trial E2E | Checkout + webhook + inbox | **SKIP** | Needs Stripe test/live keys and webhook forward. Not run. See `docs/checklists/stripe-checkout-verification.md`. |
| Real mailbox delivery | Send day-0/1/7 or webhook mail | **SKIP** | Explicitly out of scope (“do not send real mail”). |

## Leftovers

1. **`LIFECYCLE_EMAILS_ENABLED` remains off.** Cron first-week sequence will dry-run only until the owner sets the flag after mailbox + delivery verification.
2. **No live Stripe walk.** First charge / trial start in Stripe Checkout was not executed here.
3. **Welcome page does not show `expiresAt`.** It shows the plan label and links to billing. Expiry is on billing + license after the API fix.
4. **Security Review Gate.** `apps/server/src/routes/billing/routes.ts` changed. Merge may need `sec-review:approved` applied by the owner from a raw terminal.

## Doors not touched

SSO/#449, Stripe live catalog/keys, license-key migration, Starter Kit checkout, Enterprise unattended checkout. Pro/Max Start trial and Buy CTAs were not hidden or weakened.
