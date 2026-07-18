---
'@revealui/db': minor
'@revealui/security': minor
'@revealui/config': minor
---

Sign every audit-log row at the write door with per-row Ed25519, and retire the legacy HMAC path (GAP-355 Stage 3 PR-2).

**@revealui/db (signer slot):** `DrizzleAuditStore` now takes an optional injected `AuditRowSignerFn`. When supplied, each `append`/`appendBatch` fetches the row's `seq` from the sequence up front (`pg_get_serial_sequence`), signs over the full row including that `seq`, and inserts an explicit `seq` + `signature`; when absent, the DB assigns `seq` and `signature` stays NULL (dev/test). The package stays crypto-free and security-package-free — the real signer is composed and injected by the consumer. New exports: `AuditRowSignable`, `AuditRowSignerFn`. The `signature`/`previousSignature` pass-through fields are removed from `AuditEntry` (the store owns signing now; `previous_signature` is never written).

**@revealui/security (breaking, 0.x minor):** the exported-but-unwired HMAC helpers `signAuditEntry` / `verifyAuditEntry` (and the internal `SignableFields`) are removed. They signed a non-canonical 5-field subset and cannot back an offline-verifiable receipt. Use `Ed25519AuditRowSigner` + `verifyAuditRow` (RFC 8785 canonicalization over the full row) instead.

**@revealui/config:** `REVEALUI_AUDIT_HMAC_SECRET` is removed from the env schema and `RevealConfig.auditHmacSecret` is dropped. Replaced by `REVEALUI_AUDIT_SIGNING_KEY` (Ed25519 PKCS#8 PEM) + optional `REVEALUI_AUDIT_SIGNING_KID`. A signing deployment refuses to boot without a valid signing key; there is no `REVEALUI_SECRET` fallback.
