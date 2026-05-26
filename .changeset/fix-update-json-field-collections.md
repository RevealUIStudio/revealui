---
"@revealui/core": patch
---

Fix `update()` for JSON-field collections. `selectJsonByIdQuery` now selects `id` alongside `_json`, so the fetched row keeps an `id` and survives `safeParseRevealDocuments` (which drops rows whose `id` is not a string or number). Previously the id-less projection produced a dropped row and `update()` threw "Document not found" for every JSON-field collection.
