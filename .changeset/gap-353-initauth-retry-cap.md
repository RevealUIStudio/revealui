---
'@revealui/harnesses': patch
---

Bound the `HttpGateway.initAuth` bootstrap-secret retry loop to 5 attempts before failing closed, so a persistent create/delete race on the secret file cannot livelock daemon startup. Fast-follow on a non-blocking finding from the #1975 guardrail-2 security verdict (DoS-only defense-in-depth; O_EXCL + O_NOFOLLOW already prevent secret substitution).
