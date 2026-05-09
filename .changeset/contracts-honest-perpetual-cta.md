---
'@revealui/contracts': patch
---

Honest perpetual-tier CTA labels: change `cta: 'Buy License'` → `cta: 'Contact Sales'` for Pro Perpetual and Agency Perpetual entries in `PERPETUAL_TIERS` (`packages/contracts/src/pricing.ts:369,384`). The `ctaHref` for these tiers is a `mailto:` link — i.e. it opens an email to support@revealui.com — which is a "contact us" flow, not a self-serve license purchase. The previous "Buy License" label implied immediate purchase; the new label matches the actual flow and is parallel to the existing Enterprise Perpetual entry (line 399, already labeled "Contact Sales").

Audit reference: `.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md` Phase 0 Item 0.4. No behavior change — `ctaHref` and the rest of the tier metadata are unchanged. Only the button label is updated.
