---
"@revealui/auth": patch
"@revealui/config": minor
"@revealui/contracts": minor
"@revealui/db": minor
"@revealui/ai": patch
"@revealui/router": patch
"@revealui/core": patch
---

Apply current site audience and Consultation payment lifecycle to shared content reads, edits, private client delivery and RAG retrieval. Add authenticated client readers, verified provider domain reservations, and deletion prerequisites that preserve domain cleanup ownership. Callback transactions use the maintained PostgreSQL pool for the same configured database.

Hold canonical account erasure admission through deletion side effects so new hostname assignments cannot race the cleanup prerequisite.

Propagate the managed transaction lease to the shared CMS adapter and typed queries, including nested savepoints, so erasure completes with a single pooled connection.

Escape loader data in the default SSR JSON script so embedded HTML cannot create executable script elements, while preserving the data used for hydration.
