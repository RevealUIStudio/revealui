---
"@revealui/security": minor
"@revealui/core": minor
---

Require deletion storage adapters to enforce pending → processing → completed/failed transitions atomically. Concurrent processors can no longer execute the same request twice, and terminal requests cannot be replayed or overwritten. Validate deletion categories and completion data at their boundaries.

Custom `GDPRStorage` adapters must implement `claimDeletionRequest` and `finishDeletionRequest`. Claim only pending records atomically and return the claimed request; return `undefined` if no claim is possible. Finish only processing records and return whether the conditional update succeeded. `setDeletionRequest` now creates a new pending record and must reject an existing ID instead of upserting. Validate stored categories before claiming, validate completion data before updating, and return defensive copies for mutable stores. No fallback to the old read/modify/upsert sequence is supported.
