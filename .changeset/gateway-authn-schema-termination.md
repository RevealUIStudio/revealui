---
"@revealui/harnesses": minor
---

add the gateway authn persistence substrate and real process termination to the harness daemon: two additive PGlite tables (`gateway_bootstrap`, a singleton hash of the HTTP-gateway bootstrap secret; `gateway_tokens`, hashed durable bearer tokens with expiry/revocation) plus `DaemonStore` methods (`putBootstrapSecretHash`, `getBootstrapSecretHash`, `insertToken`, `findValidToken`, `revokeToken`, `pruneExpiredTokens`) as substrate for a later fail-closed gateway; and `SpawnerService.stop`/`stopAll` now escalate SIGTERM to SIGKILL after a bounded, configurable grace period (`terminationGraceMs`, default 5000ms) with event-driven status, so a child that ignores SIGTERM is actually killed and `agent.list` never reports a live process as stopped. Substrate only, no callers wired yet.
