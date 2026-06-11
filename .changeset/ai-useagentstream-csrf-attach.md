---
'@revealui/ai': minor
---

`useAgentStream` now echoes the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues) as an `X-CSRF-Token` header on both of its POSTs, `start()` and `submitElicitation()`. The API server's CSRF middleware requires that header on any session-cookie-bearing unsafe request, so cookie-authenticated browser consumers of the hook would otherwise 403 once CSRF enforcement is active. Mirrors the cookie-read in `@revealui/core`'s admin APIClient. No API change: when the cookie is absent (API-key / server-to-server callers, non-browser environments) the header is omitted and requests are unchanged.
