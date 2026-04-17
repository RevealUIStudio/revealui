---
title: "Commercial Readiness Handoff"
description: "The trust-layer gap between shipping code and charging a user — moral, secure, effective."
last-updated: 2026-04-16
status: active-handoff
owner: RevealUI Studio
---

# Commercial Readiness Handoff

This doc sits above `LAUNCH-CHECKLIST.md` (ops) and `MASTER_PLAN.md` (phases). It covers the
**trust layer** that makes the first paid customer a morally defensible, technically safe, and
retainable transaction.

The code is substantially ready. The remaining gap is not engineering — it's the operational
posture, legal scaffolding, and customer-facing honesty that turn a working app into a durable
business.

---

## Framing

| Dimension | The question | If you fail here |
|-----------|--------------|------------------|
| **Moral** | Are we charging for something we can honestly deliver, on terms the buyer understands? | Refund storms, reputation damage, fraud risk |
| **Secure** | If a paying customer's data enters the system tomorrow, can we protect it and recover from incidents? | Data breach, downtime, legal exposure |
| **Effective** | Will a customer who pays once be able to get value, get help, and keep paying? | Churn, support overwhelm, revenue leakage |

None of the three stands alone. A product can be legal but immoral (misrepresenting capabilities),
secure but ineffective (hardened storage, broken onboarding), or effective but insecure (great
UX, plaintext secrets). All three must hold.

---

## Track 1 — Moral: charge for what works

### Honest product surface

- [ ] **"What works today" page** on the marketing site, distinct from the roadmap. Every paid
      feature listed must be something a customer can invoke on day 1, not "coming soon" or
      "beta". The MASTER_PLAN distinguishes "built" from "production-verified"; the public page
      should only claim the latter.
- [ ] **Solo-operator disclosure** somewhere in the footer / About / support flow. Do not imply
      "our team" in marketing copy if it's one person. Buyers who would reject a solo-founder SaaS
      will reject it louder after they discover it post-purchase.
- [ ] **Subprocessor list** on a public page (`/legal/subprocessors`). Include: Vercel, NeonDB,
      Supabase, Stripe, the current LLM inference providers, email provider, blob storage.
      Update-on-change with a dated changelog. Required for any enterprise sale and enforced by
      most DPAs.

### Legal documents (reviewed, not just generated)

Generators (Termly, Iubenda, Stripe Atlas templates) are a starting point, **not** a substitute
for a lawyer review when you begin collecting payment.

- [ ] **Terms of Service** — include limitation of liability, governing law, refund policy,
      termination clauses, acceptable use.
- [ ] **Privacy Policy** — name every subprocessor, list data categories collected, state
      retention periods, describe DSR process.
- [ ] **Data Processing Agreement (DPA) template** — required for EU B2B customers under GDPR
      Art. 28. Most buyers will request this before signing.
- [ ] **Acceptable Use Policy** — prohibited content/uses, especially relevant for a platform
      that runs user-submitted agent tools + MCP servers.
- [ ] **Cookie / tracking disclosure** matching what's actually loaded on marketing + admin.
- [ ] **Vulnerability disclosure policy** at `/.well-known/security.txt` and `/security`.
      Promise no legal action against good-faith researchers. This is a moral obligation and a
      cheap defence against the first researcher who finds a hole.
- [ ] **Counsel review of all of the above** before any live-mode Stripe transaction. Budget for
      one pass by a SaaS-experienced attorney; this is not the place to economise.

### Refund + guarantee posture

- [ ] **Launch-window refund promise** (e.g., "14-day no-questions-asked refund for the first
      90 days of public pricing"). Explicitly logged in ToS. Reduces perceived risk for early
      adopters and signals confidence.
- [ ] **Service-credit policy** for downtime tied to a published SLA (even if the SLA is
      modest — "99% monthly uptime, pro-rated credits for anything below").

### Data handling transparency

- [ ] **Customer data map** — internal document naming every place customer data flows: Neon
      region, Supabase region, Stripe, inference providers (including whether prompts leave the
      account boundary), blob storage, logs. Surface the externally-relevant parts on the
      Privacy Policy.
- [ ] **Training-data promise** — explicit public statement of whether customer content is used
      to train any model. For RevealUI's open-inference posture this is easy to say "no"; saying
      it in writing is the point.

---

## Track 2 — Secure: before real customer data enters the system

The code-side security posture is strong (0 CodeQL alerts, RBAC/ABAC, AES-256-GCM, etc., per
MASTER_PLAN § Current Reality). The remaining work is operational.

### External validation

- [ ] **Third-party penetration test** against production or a production-equivalent staging env.
      Internal audits are necessary but not sufficient — you need someone without a stake in the
      code to find what you can't. Boutique firms run $5k–$15k for an app this size; HackerOne /
      BugCrowd offer pay-per-vuln alternatives. SOC2 eventually requires this anyway.
- [ ] **Security.txt live** (`/.well-known/security.txt`) with a disclosure address and PGP key.
- [ ] **Responsible-disclosure process tested** — at least one dry-run with a simulated report,
      end-to-end through triage → fix → disclosure.

### Operational drills (rehearsed, not just written)

- [ ] **Incident response runbook** at `docs/security/INCIDENT_RESPONSE.md` (already referenced
      in LAUNCH-CHECKLIST). Add a calendar-scheduled quarterly tabletop exercise with a
      synthetic incident; record what was missing.
- [ ] **Key rotation drill** — rotate `REVEALUI_KEK`, `REVEALUI_SECRET`, Stripe restricted keys,
      OAuth client secrets, and database credentials in staging end-to-end, timed. Document the
      exact command sequence. If you can't rotate in under an hour today, a compromise
      tomorrow will take days.
- [ ] **Backup restoration drill** — restore NeonDB and Supabase from backup into a clean
      environment. Verify RPO (how much data loss is acceptable) and RTO (how long to restore)
      against what's promised in the SLA / Privacy Policy. Unrestored backups are fiction.
- [ ] **Separate staging environment** with production-equivalent config but non-production
      data. `deploy-test.yml` provisions previews, but a persistent staging environment for
      drills + customer repro is worth the small cost.

### Account + access hygiene

- [ ] **MFA enforced on every critical external account**: Stripe, Vercel, NeonDB, Supabase,
      GitHub, npm, domain registrar, email provider. Check each one; they each have a separate
      MFA setting.
- [ ] **Privilege separation** — deploy/CI credentials (read-only push, narrow scope) distinct
      from day-to-day dev credentials. Stripe keys: use restricted keys scoped to the minimum
      resources each service needs; never the unrestricted secret in production.
- [ ] **Founder-account lockout plan** — what happens if the single human operator loses their
      laptop / phone / 2FA device in the first 30 days? RevVault entries for recovery codes,
      stored in at least two physically separate locations.

### Audit + observability

- [ ] **Audit log for admin / billing actions** that's queryable and retained to at least the
      statutory minimum for your jurisdiction. The code emits audit events; verify they land in
      a retention-backed store, not just app logs that roll over.
- [ ] **Error tracking live + triaged** — Sentry (or equivalent) on all three apps with alerting
      thresholds set. An error stream no one looks at is worse than none.
- [ ] **Uptime monitoring + public status page** — Vercel BetterStack / Instatus / similar.
      Customers check this page *first* when something feels wrong; not having one forces them
      to email you and assume the worst.

### License + payment integrity

- [ ] **License verification fail-mode decided and documented** — when the license DB is
      unreachable, does Pro access fail-open (degraded grace period) or fail-closed (paid
      customer locked out)? A circuit breaker exists; the *policy* needs to be an explicit
      choice, communicated in the ToS.
- [ ] **Stripe webhook signing verified end-to-end** in live mode, not just test mode. Replay
      attack protection (timestamp window) confirmed.
- [ ] **Metered billing ingestion reliability** — Track B agent task credits charge per event.
      Dropped events = lost revenue and customer disputes. Verify at-least-once delivery to the
      Stripe Billing Meter API with retry + dead-letter queue. Run a synthetic load test.

---

## Track 3 — Effective: customers who pay once keep paying

### Onboarding

- [ ] **Time-to-first-value target** — a new paid customer should reach a meaningful output
      (first agent task completed, first admin user added, first Stripe checkout processed)
      within 15 minutes of paying. Measure this by walking through the funnel as a stranger.
- [ ] **Empty-state design pass** on every admin surface a new Pro customer touches. Empty
      states are the UX of day 1.
- [ ] **Founding-customer feedback loop** — a private channel (Slack / Discord / scheduled
      call) for the first 10–20 paying customers. Their early friction is the roadmap.

### Support

- [ ] **One support channel, documented** — email at a minimum, with a published response
      target ("best effort within 48 business hours" is honest for a solo operator; "within 4
      hours 24×7" is not).
- [ ] **Response SLA surfaced in the pricing page** so nobody is surprised.
- [ ] **Runbook for the top 10 likely support questions** written before launch. Drafting these
      as docs up front also exposes UX gaps worth fixing instead.

### Billing lifecycle end-to-end

- [ ] **Full flow tested with a real live-mode card in a dry-run account**, not just Stripe
      test mode: checkout → webhook → license created → feature unlock → upgrade → downgrade →
      cancel → resubscribe → failed-payment → recovery.
- [ ] **Dunning emails** for failed payments (day 1, 3, 7, 14 retry cadence). Stripe can send
      these; decide whether to rely on Stripe's copy or override with RevealUI-branded emails.
- [ ] **Graceful cancel** — data retained for a documented period (e.g., 30 days) after
      downgrade to Free; re-subscribe restores access without customer-visible data loss.
- [ ] **Invoice + receipt emails** — verified they fire, branded correctly, include VAT/tax
      where applicable.
- [ ] **Stripe Tax enabled** if selling to multiple tax jurisdictions. Nexus review for US
      states if revenue is expected to exceed thresholds.

### Retention instrumentation

- [ ] **Basic product telemetry**: sign-ups, activation (first meaningful action), feature
      usage, churn. Enough to answer "is the product getting used?" without becoming a
      surveillance footprint. Self-host with PostHog or equivalent to keep the subprocessor
      list short.
- [ ] **Cohort-based churn review** cadence — monthly review of who cancelled, why, and what
      the product/pricing changes would be.

---

## Cross-cutting — Legal & financial entity

These are owner-only actions; nothing here ships in the repo.

- [ ] **Business entity formed** (LLC or C-corp depending on fundraising plans) with EIN /
      equivalent.
- [ ] **Business bank account** separate from personal.
- [ ] **Stripe account verified** and in live mode, linked to the business entity.
- [ ] **Business insurance quote obtained** — cyber liability + E&O coverage at minimum.
      Premiums for a pre-revenue solo SaaS are cheap; activate coverage before the first paid
      customer.
- [ ] **Trademark filing** for "RevealUI" wordmark in target jurisdictions (US + EU minimum).
      Cheap to file, expensive to defend later if someone else files first.
- [ ] **Accounting system** — even a spreadsheet with receipts works pre-launch. Switch to
      proper bookkeeping (Xero / QuickBooks / equivalent) on the first paid invoice.

---

## Sequencing — what blocks the first paid customer

If the goal is "cleanly take money from one real customer," the minimum non-negotiables are:

1. **Legal entity + Stripe live mode** — can't legally take payment without these.
2. **ToS, Privacy Policy, AUP lawyer-reviewed and published** — moral and legal baseline.
3. **Billing lifecycle tested end-to-end in live mode with a real card.**
4. **MFA on every critical account + key rotation drill run at least once.**
5. **Incident response runbook written + one tabletop exercise done.**
6. **Status page live + uptime monitoring pointing at it.**
7. **Sentry live + alerting set up.**
8. **One support channel published with an honest SLA.**
9. **License verification fail-mode decided, documented, and tested.**
10. **"What works today" marketing page cross-checked against the code.**

Everything else in this doc makes the business more durable but isn't blocking the first sale.

---

## Deliberately *not* blocking (do later)

- SOC2 Type II — required for enterprise (Forge) deals, not for SMB Pro. Phase 6 of MASTER_PLAN
  already tracks this.
- ISO 27001 — same as above.
- 24×7 support — not credible or necessary for a solo-operator Pro tier.
- Multi-region failover — expensive; not required by the published SLA at Pro tier.
- Bug bounty program — disclosure policy is enough at this stage; bounties introduce triage
  overhead not yet worth it.

---

## Owner decisions needed

These need explicit answers from the founder before the tracks above can resolve:

| Decision | Why it matters | Default if not decided |
|----------|----------------|------------------------|
| First product to charge for (Pro subscription? Perpetual license? Forge Docker? Track D services?) | Determines which legal / billing surfaces must be live first | Pro subscription is lowest-overhead |
| Published SLA at each tier | Sets the refund / credit obligation | Free: none; Pro: 99% monthly; Max: 99.5% monthly |
| License-check fail mode (open vs closed) | Customer-visible behaviour during outage | Fail-open with a short grace window |
| EU customers yes/no at launch | Triggers GDPR / DPA / VAT-OSS overhead | Delay EU until DPA is lawyer-reviewed |
| Refund window length | Launch trust signal vs fraud exposure | 14 days first year, then 7 days |
| Support response target | Promise in pricing page + ToS | 48 business hours for Pro |
| Marketing surface for "solo operator" framing | Trust honesty vs. perceived scale | Disclose in About / footer, not hide |

---

## What already exists (don't redo)

- `docs/LAUNCH-CHECKLIST.md` — 15-section operational pre-launch checklist.
- `docs/MASTER_PLAN.md` § Phase 5 — feature-level commercialization (Tracks A–D, owner actions).
- `docs/MASTER_PLAN.md` § Phase 6 — SOC2 Type II track for enterprise.
- `docs/security/INCIDENT_RESPONSE.md` — runbook exists; needs drill + dated review.
- `docs/PRO.md` — FSL-1.1-MIT licence terms (already public).
- `business/BUSINESS_PLAN.md` — full business plan (not read in this handoff — confirm it
  doesn't already cover the legal / entity items above).
- `packages/services` — Stripe integration code (tested in test mode; live-mode E2E still
  owed).
- `packages/security` — header, CORS, RBAC/ABAC, encryption, audit, GDPR primitives.

This handoff should be treated as alive — check each section before claiming "done," and prune
items as they resolve or as the business model sharpens.
