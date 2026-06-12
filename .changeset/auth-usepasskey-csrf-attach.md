---
'@revealui/auth': patch
---

`usePasskeyRegister` and `usePasskeySignIn` now echo the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues on page load) as an `X-CSRF-Token` header on all four passkey POSTs. The admin proxy requires that header on any session-cookie-bearing unsafe request, so passkey registration — which always runs with a session — was rejected with a 403 "CSRF token missing" once CSRF enforcement went live; passkey sign-in kept working only because its endpoints are proxy-exempt pre-auth. The token is re-read before each POST so a proxy reissue between the options and verify steps cannot strand a stale token. Mirrors the attach pattern in `@revealui/core`'s admin APIClient and `@revealui/ai`'s `useAgentStream`. No API change: when the cookie is absent (no admin session, non-browser callers) the header is omitted and requests are byte-identical to before.
