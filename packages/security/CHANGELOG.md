# @revealui/security

## 0.4.2

### Patch Changes

- Updated dependencies [9801744]
  - @revealui/contracts@0.6.2

## 0.4.1

### Patch Changes

- Updated dependencies [c77ac4f]
  - @revealui/contracts@0.6.1

## 0.4.0

### Minor Changes

- 198e56a: Add a client-safe `@revealui/security/sanitize` subpath and route rich-text RSC rendering through it — fixes a `node:crypto` client-bundle crash.

  `@revealui/core/richtext/rsc` imported `isSafeUrl` / `sanitizeUrl` from the `@revealui/security` barrel, which statically re-exports `auth.ts` and `gdpr.ts`. Both modules have a top-level `import { ... } from 'node:crypto'`, so the entire crypto graph was pulled into every client/RSC bundle that rendered rich text. In the browser `node:crypto` is unavailable, which crashed the bundle and blanked any route loading rich-text content (e.g. the marketing `/blog` route, on `main`/production).

  - `@revealui/security`: new `./sanitize` export (built as a separate tsup entry). It bundles only `src/sanitize.ts` + `parse5` — no `node:crypto` — so it is safe to import from a browser/RSC client path. The barrel is unchanged for server consumers.
  - `@revealui/core`: `richtext/exports/server/rsc.tsx` now imports the URL helpers from `@revealui/security/sanitize` instead of the barrel. No public API change; existing re-exports of `isSafeUrl` / `sanitizeUrl` are preserved.

  The sync `totpHmac` (TOTP) usage in `auth.ts` is intentionally left as a static import — converting it to a lazy `await import('node:crypto')` would force an async signature change rippling to all TOTP callers. Isolating the client path via the subpath avoids that blast radius entirely.

- 1d5a9e4: Split server-only modules behind `@revealui/security/server` so the default `@revealui/security` barrel is client-bundle-safe.

  `auth`, `gdpr`, `audit` (`node:crypto`) and `ssrf` (`node:dns`) now export from the new `@revealui/security/server` subpath. The default barrel re-exports only client-safe modules — alerting, authorization, encryption (Web Crypto), GDPR storage, headers, logger, request-IP, and input sanitization — so a browser/RSC bundle that imports `@revealui/security` no longer drags the `node:` graph in (the crash class fixed in the previous release for richtext RSC).

  `@revealui/core/security` re-exports both the barrel and `./server`, so server consumers that import via `@revealui/core/security` are unaffected. Code that imported the moved symbols (`TwoFactorAuth`, `OAuthClient`, the GDPR managers, `AuditSystem`/`audit`, `assertPublicUrl`, etc.) directly from the `@revealui/security` barrel must switch to `@revealui/security/server`, which is server-only.

- 0f2906c: Harden server-side fetches of user/tenant-supplied URLs against SSRF.

  `@revealui/security` gains `createSafeFetch()` — a `fetch` that validates the
  target resolves to a public IP and pins the connection to that IP via an undici
  dispatcher whose lookup re-validates at dial time (closing the DNS-rebinding
  TOCTOU that a bare `assertPublicUrl` + `fetch` leaves open), and refuses
  redirects (a classic SSRF-guard bypass). `assertPublicUrl()` now returns the
  validated public IPs and additionally blocks bracketed-IPv6 literals and
  hex-form IPv4-mapped loopback/private literals (e.g. `::ffff:7f00:1`) that the
  prior check missed.

  `@revealui/mcp` routes every remote MCP server connection through this guard in
  `buildRemoteMcpClient` (validating the stored server URL and pinning the
  transport's fetch). The API marketplace proxy and the admin MCP OAuth initiate
  flow now reject private/metadata/loopback targets instead of connecting to them.

### Patch Changes

- Updated dependencies [9ec7c07]
- Updated dependencies [363d4b5]
- Updated dependencies [e4a3779]
  - @revealui/contracts@0.6.0

## 0.3.1

### Patch Changes

- Updated dependencies [54557b7]
- Updated dependencies [6afae69]
- Updated dependencies [f7ea9b4]
- Updated dependencies [ad6aa4c]
- Updated dependencies [0eb3131]
- Updated dependencies [25dba49]
- Updated dependencies [9a6ebb3]
- Updated dependencies [47c75fe]
- Updated dependencies [a8ca087]
- Updated dependencies [1f7ae24]
- Updated dependencies [f56d3d3]
- Updated dependencies [f8199c8]
- Updated dependencies [37952d2]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/utils@0.3.5

## 0.3.0

### Minor Changes

- 2204021: Add `escapeSqlIdentifier` — safe interpolation of dynamic Postgres identifiers (table, column, schema names) for the narrow paths Drizzle's `sql.identifier()` can't cover.

  Emits `"name"` with embedded `"` doubled per the SQL spec. Rejects three classes of malformed input with a thrown error rather than silent corruption:

  - Empty string (would produce `""`, a syntactically valid but semantically empty identifier)
  - NUL byte (Postgres cannot store it; most drivers silently truncate)
  - Length > 63 bytes (`NAMEDATALEN - 1` — Postgres silently truncates longer names, which collapses two distinct inputs into the same identifier)

  Byte-aware length check: `Buffer.byteLength(id, 'utf8')`, not character count, since Postgres measures identifiers in bytes.

  Corpus-backed: 14 injection vectors (SQL-statement-break, multi-quote, NUL byte, UTF-8 overflow) + 12 legal-but-tricky cases (reserved words, non-ASCII, edge-length) live in `__tests__/sanitize-corpus/sql-injection.ts`.

  Prefer Drizzle's `sql.identifier()` for compile-time-known names; reach for this only when the identifier truly must flow through runtime input.

- 2204021: Add `redactLogField`, `redactLogContext`, `redactSecretsInString`, and `isSensitiveLogKey` — the single audited chokepoint for scrubbing PII and secrets out of structured log payloads. Key match is case-insensitive substring on an alnum-normalised form (so `apiKey`, `api_key`, `X-API-Key`, and `userApiKey` all redact). Value-level scrubbing removes JWTs, Bearer tokens, and Stripe / OpenAI / AWS / GitHub credential shapes even when they appear concatenated into benign message strings. Supersedes the ad-hoc `sanitizeLogData` (core) and `redactSensitiveFields` (ai) duplicates — callers should migrate.
- 7db5151: Remove deprecated `PasswordHasher` (PBKDF2) from `@revealui/security`.

  **Why:** PBKDF2 is less resistant to GPU brute-force attacks than bcrypt. `@revealui/auth` has shipped bcrypt-based password hashing (12 rounds) as the canonical implementation for several releases, and `@revealui/security`'s `PasswordHasher` has been marked `@deprecated` since its introduction. No internal callers remain in this monorepo.

  **Migration:** Replace `PasswordHasher` from `@revealui/security` with the bcrypt-based utilities exported from `@revealui/auth`.

  ```ts
  // Before
  import { PasswordHasher } from "@revealui/security";
  const hash = await PasswordHasher.hash(password);
  const ok = await PasswordHasher.verify(password, hash);

  // After
  import { hashPassword, verifyPassword } from "@revealui/auth";
  const hash = await hashPassword(password);
  const ok = await verifyPassword(password, hash);
  ```

  Hashes produced by the old PBKDF2 implementation (`salt:hash` hex format) are not verifiable by bcrypt and must be re-hashed at next login. If you have production users with PBKDF2 hashes, detect the format on login (`hash.includes(':')`) and re-hash with bcrypt after successful PBKDF2 verification.

- 2204021: Add `sanitizeHtml` — tag + attribute allow-list HTML sanitizer for Lexical render output, admin-facing markdown, and any other untrusted-HTML sink. Backed by parse5's WHATWG-spec tokenizer (same one jsdom and cheerio use) so the parser is never the attack surface.

  Baseline allow-list covers rich-text tags (paragraphs, headings, lists, tables, inline formatting, links, images). Unknown tags are unwrapped (children kept, element dropped). Dangerous containers — `script`, `style`, `iframe`, `object`, `embed`, `form`, `svg`, `math`, `template`, `noscript`, `base`, and similar — are dropped with all their children.

  Every `on*` event handler, `style` attribute, `srcdoc` attribute, and namespaced attribute (`xlink:href`, etc.) is stripped categorically. URL attributes (`href`, `src`, `cite`) flow through `isSafeUrl` with the correct context, blocking `javascript:`, `vbscript:`, and non-image `data:` schemes. Anchors with `target="_blank"` are hardened with `rel="noopener noreferrer"` automatically.

  Corpus-backed: 28 XSS/HTML-injection vectors from the OWASP cheatsheet + 13 safe-input vectors live in `__tests__/sanitize-corpus/html-injection.ts` and grow with every new attack class.

  Adds `parse5@^8.0.0` as a runtime dependency.

- 2204021: Add `sanitizeTerminalLine` for stripping ANSI escape sequences from untrusted terminal output. Preserves SGR color codes; removes CSI/OSC/DCS sequences and C0/C1 control chars. Used by RevDev Studio's terminal view.

### Patch Changes

- Updated dependencies [f6ba434]
  - @revealui/contracts@1.4.0

## 0.2.7

### Patch Changes

- Security hardening across packages: expanded dangerous URL scheme check, CodeQL alert resolution, Dependabot vulnerability fixes, security rule schemas with AST-typed ReDoS detection, and RBAC/ABAC enforcement tests.
- Updated dependencies
- Updated dependencies
  - @revealui/utils@0.3.4
  - @revealui/contracts@1.3.7

## 0.2.6

### Patch Changes

- 0f195e4: SDLC hardening, content overhaul, and cms→admin rename.

  - Promote all CI quality checks from warn-only to hard-fail
  - Kill banned phrases across 58 files (headless CMS → agentic business runtime)
  - Rename apps/cms to apps/admin throughout the codebase
  - Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
  - Add Gmail-first email provider to MCP server (Resend deprecated)
  - Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
  - Align all coverage thresholds with actual coverage
  - Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)

- Updated dependencies [0f195e4]
  - @revealui/contracts@1.3.6
  - @revealui/utils@0.3.3

## 0.2.5

### Patch Changes

- add SOC2 6.2 technical controls, local path leak detection, charge-readiness blocker fixes, and Gmail env vars to config schema
- Updated dependencies
- Updated dependencies
  - @revealui/utils@0.3.2
  - @revealui/contracts@1.3.5

## 0.2.4

### Patch Changes

- fix: security hardening, CodeQL fixes, docs, and dependency cleanup

  - Replace regex with string methods across source code (CodeQL)
  - Harden CLI content pull and remove trivial conditionals
  - Fix router dependency (core → utils) to resolve DTS build OOM
  - Add migration 0006 indexes for agent_actions, crdt_operations, boards, ticket_labels
  - Remove legacy Supabase-era billing handlers from services
  - Re-export agentMemories from db schema for published @revealui/ai compat
  - Add publishConfig.registry consistency to editors, mcp, services
  - Add READMEs and JSDoc across all packages

- Updated dependencies
  - @revealui/contracts@1.3.4
  - @revealui/utils@0.3.1

## 0.2.3

### Patch Changes

- @revealui/contracts@1.3.3

## 0.2.2

### Patch Changes

- fix(security): RFC 6238 TOTP compliance — base32 decode key and 8-byte big-endian counter encoding so generated codes match standard authenticator apps
- Updated dependencies
  - @revealui/contracts@1.3.2

## 0.2.1

### Patch Changes

- @revealui/contracts@1.3.1

## 0.2.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/utils@0.3.0
