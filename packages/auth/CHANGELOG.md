# @revealui/auth

## 0.4.10

### Patch Changes

- Updated dependencies [86780ad]
  - @revealui/contracts@0.8.1
  - @revealui/core@0.12.1
  - @revealui/security@0.5.1

## 0.4.9

### Patch Changes

- Updated dependencies [16b235f]
- Updated dependencies [11ab999]
- Updated dependencies [83846a2]
- Updated dependencies [b029d2d]
- Updated dependencies [c3c1e8f]
- Updated dependencies [1385cd6]
- Updated dependencies [077d3c4]
- Updated dependencies [578214d]
- Updated dependencies [b550aa2]
- Updated dependencies [1a49590]
- Updated dependencies [6a58057]
  - @revealui/security@0.5.0
  - @revealui/core@0.12.0
  - @revealui/db@0.9.0
  - @revealui/contracts@0.8.0
  - @revealui/config@0.6.0

## 0.4.8

### Patch Changes

- eac1a1b: remove dangling export subpaths that pointed at nonexistent source modules: `./schema/cms` in @revealui/db (no `src/schema/cms.ts`; `posts` lives in `schema/admin.ts`) and `./client` in @revealui/auth (no `src/client/` implementation). No consumer imports either subpath.
- Updated dependencies [eac1a1b]
- Updated dependencies
- Updated dependencies [0cc7f62]
- Updated dependencies [76efd75]
  - @revealui/db@0.8.0
  - @revealui/config@0.5.1
  - @revealui/core@0.11.1
  - @revealui/security@0.4.3
  - @revealui/contracts@0.7.0

## 0.4.7

### Patch Changes

- Updated dependencies [dc3e318]
- Updated dependencies [4778037]
- Updated dependencies [9801744]
- Updated dependencies [639dfa5]
  - @revealui/core@0.11.0
  - @revealui/contracts@0.6.2
  - @revealui/config@0.5.0
  - @revealui/security@0.4.2
  - @revealui/db@0.7.3

## 0.4.6

### Patch Changes

- Updated dependencies [6ac1c0d]
- Updated dependencies [95ddc7b]
  - @revealui/core@0.10.2
  - @revealui/config@0.4.3
  - @revealui/db@0.7.2
  - @revealui/contracts@0.6.1

## 0.4.5

### Patch Changes

- d5e3ff7: `useMFASetup`, `useMFAVerify`, and `useSignOut` now echo the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues on page load) as an `X-CSRF-Token` header on their five POSTs, completing the sweep `usePasskeyRegister`/`usePasskeySignIn` started: the admin proxy requires that header on any session-cookie-bearing unsafe request, and `/api/auth/mfa/*` and `/api/auth/sign-out` are not proxy-exempt — MFA enrollment and sign-out always run with a session, so without the header they were rejected with a 403 "CSRF token missing" (and a rejected sign-out left the server-side session alive). The `readCsrfToken()` helper the passkey hooks introduced now lives in a shared module used by all three hook files; passkey behavior is unchanged. The token is re-read before each POST so a proxy reissue between steps cannot strand a stale token. No API change: when the cookie is absent (no admin session, non-browser callers) the header is omitted and requests are byte-identical to before.
- 21fe1d8: docs(auth): post-auth hook examples now use a full document navigation instead of router.push(). In the Next.js App Router, a soft navigation after the session cookie changes replays the pre-auth client Router Cache (the logged-out RSC payload) and bounces the user back to the login page. The useSignIn, useSignUp, useMFAVerify, and usePasskeySignIn examples now use window.location.href, matching useSignOut and the admin auth forms. Doc comments only, no runtime change.
- f98881d: `usePasskeyRegister` and `usePasskeySignIn` now echo the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues on page load) as an `X-CSRF-Token` header on all four passkey POSTs. The admin proxy requires that header on any session-cookie-bearing unsafe request, so passkey registration — which always runs with a session — was rejected with a 403 "CSRF token missing" once CSRF enforcement went live; passkey sign-in kept working only because its endpoints are proxy-exempt pre-auth. The token is re-read before each POST so a proxy reissue between the options and verify steps cannot strand a stale token. Mirrors the attach pattern in `@revealui/core`'s admin APIClient and `@revealui/ai`'s `useAgentStream`. No API change: when the cookie is absent (no admin session, non-browser callers) the header is omitted and requests are byte-identical to before.
- cf13376: `deleteSession` now revokes every session token presented in the Cookie header instead of only the first. Browsers can hold duplicate `revealui-session` cookies (e.g. a stale host-only cookie alongside the domain-scoped one), and the stale duplicate could shadow the live token, leaving the live session row in place after sign-out.
- Updated dependencies [ff8096d]
- Updated dependencies [ed45978]
  - @revealui/core@0.10.1

## 0.4.4

### Patch Changes

- ec24584: Add `setStorage()` to the rate-limit/brute-force storage factory — a test hook to pin a specific backend (e.g. `InMemoryStorage`). Lets the DB-backed integration suite run the rate-limit/lockout logic against in-process state instead of the shared `DatabaseStorage` singleton, removing Postgres-pool contention that intermittently dropped writes under `isolate:false`.
- Updated dependencies [145975d]
- Updated dependencies [553a981]
- Updated dependencies [763e4f1]
- Updated dependencies [ebbe445]
- Updated dependencies [c77ac4f]
- Updated dependencies [a3dcac3]
- Updated dependencies [8024933]
  - @revealui/config@0.4.2
  - @revealui/core@0.10.0
  - @revealui/contracts@0.6.1
  - @revealui/db@0.7.1
  - @revealui/security@0.4.1

## 0.4.3

### Patch Changes

- Updated dependencies [96b1049]
- Updated dependencies [e08adbe]
- Updated dependencies [f8c74e6]
- Updated dependencies [ba61b20]
- Updated dependencies [6545491]
  - @revealui/db@0.7.0
  - @revealui/core@0.9.0
  - @revealui/contracts@0.6.0

## 0.4.2

### Patch Changes

- Updated dependencies [198fc08]
- Updated dependencies [9ec7c07]
- Updated dependencies [363d4b5]
- Updated dependencies [198e56a]
- Updated dependencies [1d5a9e4]
- Updated dependencies [0f2906c]
- Updated dependencies [e4a3779]
- Updated dependencies [6643d0b]
  - @revealui/core@0.8.0
  - @revealui/contracts@0.6.0
  - @revealui/db@0.6.0
  - @revealui/security@0.4.0

## 0.4.1

### Patch Changes

- 37952d2: Bump `zod` to `^4.4.3` (from `^4.3.6`) via the workspace catalog.

  These packages declare `zod` as a `catalog:` runtime dependency, so the catalog bump changes their published dependency range. No source changes — `zod` 4.4.x is API-compatible for their usage (workspace `typecheck:all` and per-package tests green).

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
- Updated dependencies [b0bab95]
- Updated dependencies [3ff25bb]
- Updated dependencies [af12683]
- Updated dependencies [37952d2]
- Updated dependencies [972b052]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [6ce0d60]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/core@0.7.0
  - @revealui/config@0.4.1
  - @revealui/db@0.5.0
  - @revealui/security@0.3.1

## 0.4.0

### Minor Changes

- f6ba434: **BREAKING (pre-1.0):** Signup now defaults to closed. New deployments must set `REVEALUI_SIGNUP_OPEN=true` or `REVEALUI_SIGNUP_WHITELIST` to allow registration. Prevents accidental open registration on new deployments.

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [284fd1f]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [2204021]
- Updated dependencies [59c670b]
- Updated dependencies [2204021]
- Updated dependencies [7db5151]
- Updated dependencies [2204021]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/core@0.6.0
  - @revealui/db@0.4.0
  - @revealui/security@0.3.0
  - @revealui/config@0.4.0
  - @revealui/contracts@1.4.0

## 0.3.8

### Patch Changes

- Security hardening across packages: expanded dangerous URL scheme check, CodeQL alert resolution, Dependabot vulnerability fixes, security rule schemas with AST-typed ReDoS detection, and RBAC/ABAC enforcement tests.
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.7
  - @revealui/config@0.3.4
  - @revealui/security@0.2.7
  - @revealui/core@0.5.6
  - @revealui/contracts@1.3.7

## 0.3.7

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
  - @revealui/core@0.5.5
  - @revealui/db@0.3.6
  - @revealui/contracts@1.3.6
  - @revealui/security@0.2.6
  - @revealui/config@0.3.3

## 0.3.6

### Patch Changes

- add SOC2 6.2 technical controls, local path leak detection, charge-readiness blocker fixes, and Gmail env vars to config schema
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5
  - @revealui/security@0.2.5
  - @revealui/config@0.3.2

## 0.3.5

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
  - @revealui/config@0.3.1
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3
  - @revealui/db@0.3.4

## 0.3.4

### Patch Changes

- fix(auth): passkey rpId reads from PASSKEY_RP_ID env var, throws in production if still localhost
- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3
  - @revealui/core@0.5.2

## 0.3.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2
  - @revealui/core@0.5.1

## 0.3.2

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.3.1

### Patch Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13
- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/core@0.3.0
  - @revealui/contracts@1.2.0
  - @revealui/db@0.3.0
  - @revealui/config@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.1.0
  - @revealui/core@0.2.1

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI session-based authentication.

  - Sign in, sign up, and sign out flows
  - Password reset with email tokens
  - bcrypt password hashing with configurable rounds
  - Rate limiting (per-IP and per-user)
  - Session management with cookie handling
  - Auth middleware and guards
  - Account lockout after failed attempts

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/config@0.2.0
  - @revealui/contracts@1.0.0
  - @revealui/core@0.2.0
  - @revealui/db@0.2.0
