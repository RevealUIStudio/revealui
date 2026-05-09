---
'@revealui/services': minor
---

Remove unused `checkServicesLicense` export. Per the 2026-05-08 charge-readiness
audit Phase 2 Path A: the function was declared but never called in any feature
code path; Stripe, RevealCoin, and Vercel integrations ran unconditionally.

License normalized from MIT to FSL-1.1-MIT: a runtime tier check was incoherent
with MIT's "use without restriction" grant. LICENSE file added to the package.
