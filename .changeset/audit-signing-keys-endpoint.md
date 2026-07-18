---
'@revealui/security': minor
'@revealui/setup': minor
'@revealui/core': minor
---

Promote the audit-row signer composition into `@revealui/security` and add key provisioning + a public-key endpoint (GAP-355 Stage 3).

- `@revealui/security` gains `createAuditRowSignerFromEnv`, `resolveAuditPublicKey`, and `deriveAuditKid` (server entry) — the single env→signer→kid derivation shared by every audit writer, re-exported through `@revealui/core/security`.
- `@revealui/setup` generates a per-deployment Ed25519 audit-signing keypair (`generateAuditSigningKeypair`), writes the private key to the env output, and prints the kid + public key for offline receipt verification. Adds a `@revealui/security` dependency.
- A new unauthenticated `GET /api/audit/public-key` publishes the SPKI public key + kid so a customer can verify an audit-log record offline, without our secret. Unsigned deployments answer an honest 404.
