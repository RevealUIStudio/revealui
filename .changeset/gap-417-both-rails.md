---
'@revealui/auth': minor
'@revealui/db': minor
'@revealui/security': minor
---

GAP-417 both rails (owner-countersigned): the audit path has no escape hatch into unsigned production rows. `assertAuditStorageEnv` refuses a production boot without the signing key regardless of `SKIP_ENV_VALIDATION`; `DrizzleAuditStore.append`/`appendBatch` refuse to land an unsigned row when `NODE_ENV=production`; and the signer composition normalizes single-line `\n`-escaped PEMs so `env_file` transports (RevForge kits) can carry the key.
