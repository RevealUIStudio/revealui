---
"@revealui/core": minor
---

Add tiered license fail-mode with grace periods. New `getLicenseStatus()` returns `LicenseCheckResult` with mode (active/grace/read-only/expired/invalid/missing), grace remaining, and read-only flag. Configurable grace windows: 3-day subscription, 30-day perpetual, 7-day infra-unreachable. Add iss/aud claims to license JWTs for cross-environment replay prevention. Remove ES256 from allowed JWT algorithms (only RS256 is issued).
