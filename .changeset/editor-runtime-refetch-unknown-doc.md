---
'@revealui/editor': patch
---

Fix `initEditRuntime`'s inbound `rvui:apply-patch` handler silently dropping a patch whose docId was materialized on the session server after the runtime's initial preview fetch (the canonical case: a fresh session's first field patch, since a session doc only materializes on its own first PATCH). The handler now re-fetches the preview payload once on a doc-id miss, shared across any concurrent misses, before retrying the patch; a still-missing doc after the refetch (or a failed refetch) keeps the prior fail-quiet drop.
