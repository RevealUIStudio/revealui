---
"@revealui/knowledge-graph": patch
---

Make `@revealui/ts-strada` optional so published `@revealui/knowledge-graph` installs without that private workspace package. Scan extractors still use it when present; search, ingest, and `assembleContext` do not.
