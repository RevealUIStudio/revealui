---
"@revealui/auth": minor
---

**BREAKING (pre-1.0):** Signup now defaults to closed. New deployments must set `REVEALUI_SIGNUP_OPEN=true` or `REVEALUI_SIGNUP_WHITELIST` to allow registration. Prevents accidental open registration on new deployments.
