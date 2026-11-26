---
"@revealui/db": patch
"@revealui/ai": patch
---

Attribute new task receipts to the authenticated actor and workspace. Leave historical receipts unattributed rather than guessing ownership. Task completion now reflects configured execution; unavailable providers and unsupported empty input return actionable failed tasks instead of completed placeholder output.
