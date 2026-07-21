---
"@revealui/harnesses": minor
---

feat(harnesses): GAP-199 native master-spec coupling advisory on file-edit hooks

Provider-agnostic twin of the Claude PostToolUse master-spec-pr-coupling hook.
Warns (never blocks) when contracts/db schema/apps sources edit without the
product canon doc dirty; wired through runHookCommand for all editor sources.
