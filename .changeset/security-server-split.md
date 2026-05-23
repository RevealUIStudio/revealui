---
"@revealui/security": minor
"@revealui/core": patch
---

Split server-only modules behind `@revealui/security/server` so the default `@revealui/security` barrel is client-bundle-safe.

`auth`, `gdpr`, `audit` (`node:crypto`) and `ssrf` (`node:dns`) now export from the new `@revealui/security/server` subpath. The default barrel re-exports only client-safe modules — alerting, authorization, encryption (Web Crypto), GDPR storage, headers, logger, request-IP, and input sanitization — so a browser/RSC bundle that imports `@revealui/security` no longer drags the `node:` graph in (the crash class fixed in the previous release for richtext RSC).

`@revealui/core/security` re-exports both the barrel and `./server`, so server consumers that import via `@revealui/core/security` are unaffected. Code that imported the moved symbols (`TwoFactorAuth`, `OAuthClient`, the GDPR managers, `AuditSystem`/`audit`, `assertPublicUrl`, etc.) directly from the `@revealui/security` barrel must switch to `@revealui/security/server`, which is server-only.
