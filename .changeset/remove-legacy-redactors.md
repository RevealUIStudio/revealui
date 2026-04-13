---
'@revealui/core': major
'@revealui/ai': major
---

Remove the legacy log-redaction duplicates in favor of the audited `@revealui/security` chokepoint.

- `@revealui/core`: `sanitizeLogData` (exported from `@revealui/core/observability/logger`) is gone. Replace with `redactLogContext` from `@revealui/security` — same intent, broader coverage (recurses into arrays, scrubs inline secret shapes in string values, depth-capped at 8).
- `@revealui/ai`: `redactSensitiveFields` (exported from `@revealui/ai/llm/client`) is gone. Replace with `redactLogContext` from `@revealui/security`.

Behavior is strictly broader, not narrower, so existing redactions continue to fire. Consumers that relied on arrays being passed through unredacted will now see array members walked.
