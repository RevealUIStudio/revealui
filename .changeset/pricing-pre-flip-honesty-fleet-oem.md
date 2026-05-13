---
'@revealui/contracts': patch
---

Pre-flip pricing honesty: reframe Enterprise tier as RevealUI Fleet OEM (white-label deployment), drop services from public API response, update FEATURE_LABELS for accuracy.

- `SUBSCRIPTION_TIERS[3]` (Enterprise): bullet `'Multi-tenant architecture'` + `'White-label branding (coming soon)'` → single bullet `'RevealUI Fleet license — branded white-label deployment for your own customers (managed setup)'`. The "multi-tenant architecture" claim implied hosted SaaS multi-tenancy; code ships single-instance license-enforced self-host with per-customer revforge stamping for Enterprise. The new copy matches what's actually deliverable today (white-label deployment via hand-stamped revforge kits).
- `PERPETUAL_TIERS[1]` (Agency Perpetual): description `'Deploy for multiple clients without per-site subscriptions.'` → `'RevealUI Fleet license for agencies. Sell branded RevealUI to your clients without per-site subscriptions.'` Leans into the OEM/reseller positioning the agency-perpetual track was always implicitly serving.
- `FEATURE_LABELS.multiTenant` (`'Multi-tenant Management'` → `'Multi-site Content Management'`): the feature flag governs within-install multi-site management (the `sites` table), not hosted SaaS multi-tenancy. New label removes the ambiguity.
- `FEATURE_LABELS.whiteLabel` (`'(Coming Soon)'` → `'(managed setup via revforge)'`): white-label is available today via hand-stamped revforge kits at the Enterprise tier; "coming soon" understated what's already shipped.

Audit reference: `.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md` §5 Phase 1.9 (multi-tenant copy resolution) and the service-offering deliverability audit (2026-05-10). No type-level breaking changes — exports, type shapes, and enum keys all unchanged.
