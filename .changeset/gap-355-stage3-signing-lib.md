---
'@revealui/security': minor
---

audit signing library (GAP-355 Stage 3 PR-1): add `canonicalizeJcs` (RFC 8785 JSON canonicalization, promoted + hardened from the mcp-audit canonicalizer) to the client-safe barrel, and the per-row Ed25519 signer + verifier to `@revealui/security/server` — `Ed25519AuditRowSigner` (implements the `AuditRowSigner` injection interface, emits `v1.ed25519.<kid>.<base64url>`), `verifyEd25519AuditSignature` / `verifyAuditRow`, `auditSignableBytes` (the shared sign-and-verify byte builder over the integrity-bearing columns incl. `sequence`/`tenant`), and `classifyAuditSignature`. Library only — no caller wired yet (Stage 3 PR-2 injects it at the DrizzleAuditStore door and retires the legacy HMAC).
