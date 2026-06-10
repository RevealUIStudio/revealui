---
'@revealui/config': patch
---

Treat empty-string branding env vars as unset in `getBrandingConfig`. Docker Compose `${VAR:-}` interpolation delivers unset vars to containers as empty strings, which previously short-circuited the brand-name fallback chain (producing an empty brand name) and leaked `''` into optional `logoUrl` / `primaryColor` fields.
