---
'@revealui/security': minor
---

Add `redactLogField`, `redactLogContext`, `redactSecretsInString`, and `isSensitiveLogKey` — the single audited chokepoint for scrubbing PII and secrets out of structured log payloads. Key match is case-insensitive substring on an alnum-normalised form (so `apiKey`, `api_key`, `X-API-Key`, and `userApiKey` all redact). Value-level scrubbing removes JWTs, Bearer tokens, and Stripe / OpenAI / AWS / GitHub credential shapes even when they appear concatenated into benign message strings. Supersedes the ad-hoc `sanitizeLogData` (core) and `redactSensitiveFields` (ai) duplicates — callers should migrate.
