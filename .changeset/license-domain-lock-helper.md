---
"@revealui/core": minor
---

Add `hostMatchesLicensedDomains(host, domains)` to the license module — the single domain-match primitive for RevForge/Fleet domain-lock. Allowed domains are sourced from the signed JWT `domains` claim (cryptographically bound), consumed by the API's `requireDomain` middleware, the admin boot check, and `validateLicenseAtStartup`. Replaces the env-var-driven `REVFORGE_LICENSED_DOMAIN` host matching.
