---
'@revealui/security': minor
---

Add `escapeSqlIdentifier` — safe interpolation of dynamic Postgres identifiers (table, column, schema names) for the narrow paths Drizzle's `sql.identifier()` can't cover.

Emits `"name"` with embedded `"` doubled per the SQL spec. Rejects three classes of malformed input with a thrown error rather than silent corruption:

- Empty string (would produce `""`, a syntactically valid but semantically empty identifier)
- NUL byte (Postgres cannot store it; most drivers silently truncate)
- Length > 63 bytes (`NAMEDATALEN - 1` — Postgres silently truncates longer names, which collapses two distinct inputs into the same identifier)

Byte-aware length check: `Buffer.byteLength(id, 'utf8')`, not character count, since Postgres measures identifiers in bytes.

Corpus-backed: 14 injection vectors (SQL-statement-break, multi-quote, NUL byte, UTF-8 overflow) + 12 legal-but-tricky cases (reserved words, non-ASCII, edge-length) live in `__tests__/sanitize-corpus/sql-injection.ts`.

Prefer Drizzle's `sql.identifier()` for compile-time-known names; reach for this only when the identifier truly must flow through runtime input.
