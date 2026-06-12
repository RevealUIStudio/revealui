---
"@revealui/auth": patch
---

`deleteSession` now revokes every session token presented in the Cookie header instead of only the first. Browsers can hold duplicate `revealui-session` cookies (e.g. a stale host-only cookie alongside the domain-scoped one), and the stale duplicate could shadow the live token, leaving the live session row in place after sign-out.
