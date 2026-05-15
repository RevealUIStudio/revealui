---
'@revealui/contracts': patch
---

Pro and Max subscription tiers: CTA changed from "Start Free Trial" to "Join the waitlist", with `ctaHref` pointed at the contact page. Stripe runs in TEST mode in production — there is no live trial-to-paid path yet, so "Start Free Trial" overstated what the funnel can deliver. Per the 2026-05-14 public messaging audit (honesty doctrine). The admin upgrade page does not consume `ctaHref`, so the in-app upgrade flow is unaffected.
