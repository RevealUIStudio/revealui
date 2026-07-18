---
'@revealui/core': minor
---

Add `validateLicenseKeyForRefresh` and the `REFRESH_ACCEPT_DAYS` constant to the license module. The refresh validator verifies a presented license JWT within a wider bounded-expiry window than the run-time validation grace, reusing the same rotation-aware multi-key verification path, so a running instance can obtain its current stored key without a new key being minted.
