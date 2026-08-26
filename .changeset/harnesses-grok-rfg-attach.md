---
"@revealui/harnesses": patch
---

Grok adapter: `manager materialize` emits hook JSON in the project tree only. RevKit `rfg`/bootstrap deploys those templates (and the PreToolUse helper) to the vendor attach point. Drop the home `cp` recipe.
