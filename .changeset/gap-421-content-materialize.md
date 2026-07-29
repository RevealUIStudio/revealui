---
"@revealui/harnesses": patch
---

Commit generated `.revealui/content/` and gate freshness (GAP-421 content materialization ADR phase 1): un-ignore the tree, require it in `checkManager`, add `validate:content-freshness` / CI hard-fail, and clarify adapter load paths until phase 2.
