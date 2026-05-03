---
'@revealui/contracts': minor
---

Add `@revealui/contracts/secrets` subpath: `SecretPathSchema` (revvault path convention), `RotationEventSchema`, `SecretAuditEventSchema`, plus actor / reason / event-type enums and `parseSecretPath` / `isSecretPath` / `createRotationEvent` / `createSecretAuditEvent` factory helpers. Source-of-truth schemas for revvault IPC payloads and any TypeScript consumer of revvault-managed secrets. Hashes are SHA-256 hex digests; secret values are never carried in events or audit log entries by design.
