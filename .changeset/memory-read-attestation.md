---
"@revealui/knowledge-graph": patch
---

Require authorized authored metadata for graph reads in datasets containing
incomplete memory provenance. Verify immutable memory edge payloads before
returning them, including when a later episode shares an edge identity.
Inventory marked historical episodes with missing or invalid snapshots.
