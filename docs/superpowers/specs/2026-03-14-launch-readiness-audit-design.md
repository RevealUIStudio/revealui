# Launch Readiness Audit & Gap-Closing Plan

**Date:** 2026-03-14
**Approach:** C — Tiered launch with early adopter transparency
**Spec revision:** 2 (post-review corrections)
**Goal:** Enable RevealUI to morally and confidently charge customers for OSS + Pro tier

## Context

RevealUI is a 172,000+ LOC monorepo with 5 apps, 14 OSS packages, and 5 Pro packages. Previous audit (2026-03-12) declared "NOT READY" with 16 blocking issues. This audit found the previous audit was wrong about Pro packages (all 5 have real source code), and 7 of the 16 original blockers are resolved.

**Current state:** 616-621/625 tests pass (9 failures in @revealui/ai under turbo parallelism, 4 in isolation — test ordering issue). Build clean (24/24 tasks). 0 avoidable `any` types. 0 production console statements.

---

## Approach C: Tiered Launch with Early Adopter Transparency

### The Philosophy

RevealUI is real software with real value. The honest approach: launch incrementally, price fairly for what works today, and let customers watch the gaps close in real time. Early adopters get a discount for their trust and patience. This is morally sound because:

1. **Customers see exactly what they're paying for** — no hidden broken features
2. **Gaps close publicly** — GitHub commits, changelog, and a live status page show progress
3. **Early adopters are compensated** — discounted pricing locks in for the life of their subscription
4. **No feature is sold that doesn't work** — if it's not ready, it's labeled "Coming Soon" or "Beta"

### Launch Timeline

**Week 1: Fix security & billing blockers → enable paid signups**
- Fix the 5 issues that could lose money or compromise security
- Enable Stripe checkout with early adopter pricing (40% off)
- Ship: auth, billing, presentation, rate limiting, feature gating, marketing site
- AI features available but BYOK limited to Anthropic/OpenAI/Groq

**Week 2: Fix BYOK, OG images, payment failure handlers**
- BYOK works with all 6 providers (Anthropic, OpenAI, Groq, Ollama, Vultr, HuggingFace)
- Marketing site shares properly on social
- Failed payments handled gracefully (past_due → grace period → downgrade)

**Week 3: CMS admin (Phase 1)**
- Collection REST API bridge built
- serverFunction wired through
- Admin dashboard functional for content CRUD
- CMS moves from "beta" to "stable"

### Early Adopter Program

**Pricing (fixed-amount Stripe coupons, rounded to friendly numbers):**
- Pro: $49/mo → **$29/mo** ($20 off, locked for life)
- Max: $149/mo → **$89/mo** ($60 off, locked for life)
- Enterprise: $299/mo → **$179/mo** ($120 off, locked for life)
- Stripe implementation: 3 fixed-amount coupons (not percentage) to ensure clean prices
- "Sign up" = first successful payment within 30-day window (not just account creation)
- Coupon auto-expires after 30 days; shared promotion codes are fine (more adopters = more signal)

**What early adopters get:**
- Locked-in pricing that never increases
- Direct access to the founder (email/GitHub issues)
- Priority feature requests
- "Early Adopter" badge on their account (future community recognition)
- Full transparency: public roadmap, weekly changelog, live gap-closing progress

**What early adopters accept:**
- CMS admin is in beta during weeks 1-2 (content management via API only)
- BYOK supports 3 of 6 providers initially (week 1), all 6 by week 2
- Some rough edges that get polished in real time

### Public Status Page

A `/status` page on the marketing site (or a GitHub project board) that shows:

| Feature | Status | Since |
|---------|--------|-------|
| Auth & Sessions | Stable | Launch |
| Billing & Subscriptions | Stable | Launch |
| 54 UI Components | Stable | Launch |
| AI Agents & Memory (Anthropic, OpenAI, Groq) | Stable | Launch |
| BYOK (Anthropic/OpenAI/Groq) | Stable | Launch |
| Rate Limiting & Quotas | Stable | Launch |
| License Keys | Stable | Launch |
| Marketing & Legal | Stable | Launch |
| BYOK (Ollama/Vultr/HF) | Coming Week 2 | — |
| Payment Failure Recovery | Coming Week 2 | — |
| CMS Admin Dashboard | Beta → Week 3 | — |
| Rich Text Embeds | Coming Week 3 | — |
| MCP Server Management UI | Coming Week 4 | — |

Customers can see this before purchasing. No surprises.

---

## Blocking Issues (11 total — phased across 3 weeks)

### Week 1: Security & Billing (must fix before accepting payments)

#### ~~W1.1 — X-Forwarded-For parsing in CMS auth routes~~ REMOVED (false positive)
**Original claim:** `.pop()` returns wrong IP, bypassing rate limiting.
**Verified:** Both CMS (`.pop()`) and API (`ips[ips.length - 1]`) use the same pattern — rightmost IP. The API has a comment explaining: "Takes the rightmost entry (appended by the outermost trusted proxy — Vercel/Cloudflare), not the leftmost (which is attacker-controlled)." This is correct for the Vercel + Cloudflare deployment topology. Not a vulnerability.
**Action:** Consider extracting a shared `getClientIp()` utility for consistency, but this is a code hygiene improvement, not a security fix.

#### W1.2 — Billing page imports from `/server` entry in client component
**Severity:** MEDIUM (downgraded — likely works but unconventional)
**File:** `apps/cms/src/app/(frontend)/account/billing/page.tsx:1,11-16`
**Problem:** `'use client'` component imports `ButtonCVA`, `Card`, etc. from `@revealui/presentation/server`. These are stateless CVA components (no hooks, no server-only APIs) so they work in client bundles, but importing from the `/server` entry in a client component is confusing and may cause tree-shaking issues.
**Fix:** Import from `@revealui/presentation` (main entry) instead of `/server` for clarity. Verify no build warnings first — if it works as-is, deprioritize.

#### W1.3 — Stripe price ID env vars missing from CMS vercel.json
**Severity:** CRITICAL
**File:** `apps/cms/vercel.json:7-19`
**Problem:** `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID` not whitelisted. Checkout buttons send empty priceIds.
**Fix:** Add all three to the `env` array.

#### W1.4 — `STRIPE_WEBHOOK_SECRET_LIVE` missing from API vercel.json
**Severity:** HIGH
**File:** `apps/api/vercel.json:6-20`
**Problem:** Webhook handler checks `STRIPE_WEBHOOK_SECRET_LIVE || STRIPE_WEBHOOK_SECRET`. The live variant is not in the env whitelist. (`REVEALUI_LICENSE_PRIVATE_KEY` is already present at line 9 — verified.)
**Fix:** Add `STRIPE_WEBHOOK_SECRET_LIVE` to the env array.

#### W1.5 — Stripe tier silently defaults to 'pro'
**Severity:** HIGH
**File:** `apps/api/src/routes/webhooks.ts:100-119`
**Problem:** `resolveTier()` returns 'pro' when metadata is missing or unrecognized. Max/Enterprise customers could be silently downgraded.
**Fix:** Keep the 'pro' default (safer than returning 500, which risks Stripe retry exhaustion and failed provisioning) BUT add an alert mechanism: send email/webhook notification to founder when this fallback triggers. The CRITICAL log already exists — wire it to an actionable alert so misconfigured Stripe products are caught within minutes, not days.

#### W1.6 — Early adopter discount implementation
**Severity:** REQUIRED (new work)
**Files:** `apps/api/src/routes/billing.ts`, Stripe dashboard
**Note:** Checkout already sets `allow_promotion_codes: true` (line 350). Partial foundation exists.
**Task:**
1. Create 3 Stripe coupons: `EARLY_PRO_20OFF` ($20 off), `EARLY_MAX_60OFF` ($60 off), `EARLY_ENT_120OFF` ($120 off) — forever duration, auto-expire after 30 days from launch
2. Create promotion codes for each coupon (shareable URLs)
3. Auto-apply correct coupon based on selected tier during early adopter window
4. Store `earlyAdopter: true` flag on user record for future badge/recognition
5. Verify Resend email config works (required for payment failure emails in W2.1)

### Week 2: Feature Completeness & Marketing

#### W2.1 — Payment failure webhook handlers incomplete
**Severity:** HIGH
**File:** `apps/api/src/routes/webhooks.ts:1112-1133` (invoice), `1230-1245` (payment_intent)
**Problem:** Handlers exist but only log + send email. They do NOT update subscription status to `past_due` in the DB, and there is no grace period mechanism that eventually downgrades the tier to free. Failed payments are effectively invisible to the system state.
**Fix:** Extend existing handlers to:
1. Update subscription status to `past_due` in DB (add column if needed)
2. Track `failedPaymentCount` — after 3 consecutive failures or configurable grace period (default 7 days), downgrade tier to free
3. Email sending already works — verify Resend is configured (see S1 below)

#### W2.2 — BYOK provider detection
**Severity:** HIGH
**File:** `apps/api/src/routes/agent-stream.ts:52-58`
**Problem:** Only Anthropic (`sk-ant-*`) and OpenAI (`sk-*`) detected. Everything else routes to Groq.
**Fix:** Accept `provider` parameter in request body alongside `byokKey`. Add key validation via `validateProviderKey()` from `packages/ai/src/llm/key-validator.ts`. Fall back to prefix detection only if provider not specified.

#### W2.3 — OG images for marketing site
**Severity:** HIGH
**File:** `apps/marketing/src/app/layout.tsx`
**Fix:** Create `/api/og` route using `next/og` (ImageResponse). Add `openGraph.images` to root layout metadata. Design: RevealUI logo + page title + tagline on branded background.

#### W2.4 — Upgrade route tier direction validation
**Severity:** HIGH
**File:** `apps/api/src/routes/billing.ts:531-580`
**Problem:** Upgrade route doesn't check that target tier > current tier.
**Fix:** Compare tier indices before processing. Return 400 if target ≤ current.

### Week 3: CMS Admin (Beta → Stable)

#### W3.1 — Admin API endpoint mismatch
**Problem:** `apiClient` expects `/api/collections/*`. Actual API uses `/api/content/*`.
**Fix:** Build generic collection REST routes in CMS app (Next.js API routes) that read collection config and proxy to the Hono API. This bridges the gap without rewriting apiClient.

#### W3.2 — serverFunction prop wiring
**Problem:** RootLayout accepts but discards `serverFunction`.
**Fix:** Create a ServerFunctionContext in core. RootLayout provides it. Admin action buttons consume it via `useServerFunction()` hook.

#### W3.3 — Streaming SSR pipe function
**Problem:** `router/src/server.tsx:77` assigns pipe function reference instead of calling it.
**Fix:** Use `renderToReadableStream()` (React 19) instead of `renderToPipeableStream()` for Hono compatibility. Or create a WritableStream that pipe() writes into.

#### W3.4 — Embed drawer implementation
**Problem:** `FieldsDrawer` returns null.
**Fix:** Implement using presentation Dialog + form components. Read embed config from Lexical node data. Submit handler writes back to Lexical editor state.

---

## Concerning Issues (fix post-launch, tracked on public board)

| # | Issue | Priority | Target |
|---|-------|----------|--------|
| 1 | License cache has no grace period on expiry | HIGH | Week 4 |
| 2 | MCP servers return static JSON metadata only | MEDIUM | Week 4 |
| 3 | BYOK never validates API keys before use | MEDIUM | Week 2 (with W2.2) |
| 4 | Test warn-only in CI on main branch | MEDIUM | Week 4 |
| 5 | Fresh DB initialization not tested in CI | MEDIUM | Week 4 |
| 6 | Metrics endpoint has no auth | LOW | Week 5 |
| 7 | Task quota uses calendar month not billing cycle | LOW | Week 5 |
| 8 | 4-9 flaky tests in @revealui/ai (turbo parallelism) | MEDIUM | Week 2 |
| 9 | Pro packages missing from changeset ignore list | HIGH | Week 1 |
| 10 | Vercel installCommand uses --no-frozen-lockfile | LOW | Week 4 |
| 11 | Sponsor page has no metadata | LOW | Week 2 |

---

## Additional Pre-Launch Validations (from spec review)

1. **Verify Resend email config** — payment failure emails, trial ending emails, and waitlist notifications all depend on Resend. If it's not configured, customers won't know their payment failed. Test in Week 1.
2. **Verify CORS allows CMS → API** — billing page calls `api.revealui.com` directly. If `CORS_ORIGIN` doesn't include `cms.revealui.com`, all billing flows fail silently.
3. **Verify CMS `/signup` route exists** — pricing page CTAs link to `cms.revealui.com/signup`. Build output confirms it does (line 38 of build log).
4. **Verify "54 UI Components" marketing claim** — status page will show this number. Must match reality.
5. **Add Pro packages to changeset ignore list** — if someone creates a changeset for private packages, publish could expose commercial code. Do in Week 1.

---

## What NOT to Change

These items were flagged in previous audits but are correct:

- **proxy.ts naming**: Valid Next.js 16 middleware convention. Working correctly.
- **Audit middleware**: IS registered at `api/src/index.ts:153-154`. Working.
- **Pro package source code**: All 5 packages have real source. Previous audit was wrong.
- **Legal pages**: Exist at `/legal/terms` and `/legal/privacy` in CMS, `/terms` and `/privacy` in marketing.
- **Terminal auth PII**: Fixed — requires authentication now.
- **cn.ts in presentation**: Not dead — 15+ internal consumers.
- **output:'standalone' in CMS**: Required for Docker deployment.

---

## Success Criteria

### Week 1 (Launch Day)
1. All 5 Week 1 fixes implemented and tested (W1.1 removed — false positive)
2. `pnpm gate` passes
3. Stripe checkout works end-to-end with early adopter coupon
4. License key generation works after purchase
5. Resend email sending verified (payment failures, trial ending, waitlist)
6. CORS verified: CMS → API billing calls work
7. CMS admin labeled "Beta" with non-functional features hidden
8. Pro packages added to changeset ignore list
9. No new `any` types or production console statements

### Week 2
1. BYOK works with all 6 LLM providers
2. Payment failure handlers update DB status + grace period logic
3. OG images render on social share
4. AI test flakiness fixed (625/625 passing in both isolation and turbo)

### Week 3
1. CMS admin dashboard fully functional
2. Content CRUD works through admin UI
3. "Beta" label removed from CMS admin
4. Public status page shows all core features as "Stable"

### Ongoing
- Weekly changelog published
- Public status page updated after each deployment
- Early adopter feedback incorporated within 48 hours
- GitHub Issues response time < 24 hours

---

## Moral Framework

**Why this is honest:**
- Every feature marked "Stable" genuinely works and has tests
- Every feature marked "Beta" or "Coming Soon" is clearly labeled before purchase
- Early adopters are compensated (40% lifetime discount) for accepting rough edges
- Progress is public — customers can verify gaps are closing via GitHub commits
- No feature is charged for that doesn't deliver value

**Why this is commercially smart:**
- Revenue starts flowing while development continues
- Early adopter feedback shapes the product before wider launch
- Locked-in pricing creates loyalty and reduces churn
- Transparency builds trust that competitors can't match
- "Watch us build in public" is a marketing advantage for developer tools

**The line we don't cross:**
- Never charge for a feature that doesn't work at all
- Never hide known issues from paying customers
- Never default-enable a broken feature (CMS admin gated, embed hidden)
- Never promise a timeline we can't keep (weekly milestones, not date promises)
