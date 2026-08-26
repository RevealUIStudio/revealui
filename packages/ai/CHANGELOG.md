# @revealui/ai

## 1.0.0

### Major Changes

- 963f61c: Remove deprecated `ANTHROPIC_PRICING` from `@revealui/ai/llm/cache-utils`. Use `MODEL_PRICING` from token-counter (package root re-export).
- 476a667: Remove the legacy hypervisor MCP agent adapter. Mount MCP tools with `createToolsFromMcpClient` / `mcpClients` only. Deleted public surface: `discoverMCPTools`, `MCPToolSource`, `AgentRuntime.mcpToolSource`, `createToolFromMCP`, `registerMCPTools`. `MCPHypervisor` in `@revealui/mcp` is unchanged — connect spawned servers with a real `McpClient`.

### Minor Changes

- 45133b2: Add the model-artifact C-SCRM door (URL plus sha256, refuse pickle-class formats) and claim-gates holds that block C-SCRM, trustworthy-AI, AML-hardened, and weight-scan product claims.

### Patch Changes

- ad27ca4: Export Groq, xAI, OpenAI, and Anthropic provider subpaths so the Apify Store actor can load BYOK chat without importing the `@revealui/ai` package root (db/config).
- Updated dependencies [a5b8022]
- Updated dependencies [700413b]
- Updated dependencies [5a0fbe7]
  - @revealui/core@0.14.0
  - @revealui/contracts@0.8.3

## 0.10.1

### Patch Changes

- @revealui/core@0.13.1

## 0.10.0

### Minor Changes

- 86048ac: Add hardware capability profiles (constrained / mainstream / workstation) for GAP-297 local-inference vocabulary. Additive; no default path change when unconfigured.

### Patch Changes

- Updated dependencies [fcd7273]
  - @revealui/core@0.13.0

## 0.9.1

### Patch Changes

- Updated dependencies [c02e613]
  - @revealui/contracts@0.8.2
  - @revealui/core@0.12.4

## 0.9.0

### Minor Changes

- 5ad90c8: Extend the BYOK key validator with the GAP-360 hosted providers: anthropic, openai, and xai keys are now probed against their models endpoints (401/403 rejects, outages never block storage), and inference-snaps joins ollama as an accepted local provider. Base URL env overrides (ANTHROPIC_BASE_URL, OPENAI_BASE_URL, XAI_BASE_URL) are honored, matching the env factory.

### Patch Changes

- Updated dependencies [fb3315c]
- Updated dependencies [94d1714]
  - @revealui/db@0.10.0
  - @revealui/core@0.12.2
  - @revealui/contracts@0.8.1

## 0.8.1

### Patch Changes

- Updated dependencies [86780ad]
  - @revealui/contracts@0.8.1
  - @revealui/core@0.12.1

## 0.8.0

### Minor Changes

- 33fa1a7: add xai (Grok) as a BYOK LLM provider: a thin OpenAI-compatible wrapper over `https://api.x.ai/v1` (default model `grok-4.5`), following the existing anthropic/groq adapter pattern (no vendor SDK). Wires `xai` into `LLMProviderType`, `hostedViable`, `createProvider`, `createLLMClientFromEnv` (`XAI_API_KEY`/`XAI_BASE_URL`), and the admin Settings, API Keys provider list.

### Patch Changes

- Updated dependencies [16b235f]
- Updated dependencies [11ab999]
- Updated dependencies [83846a2]
- Updated dependencies [b029d2d]
- Updated dependencies [c3c1e8f]
- Updated dependencies [1385cd6]
- Updated dependencies [077d3c4]
- Updated dependencies [578214d]
- Updated dependencies [1a49590]
- Updated dependencies [6a58057]
  - @revealui/core@0.12.0
  - @revealui/db@0.9.0
  - @revealui/contracts@0.8.0

## 0.7.0

### Minor Changes

- fa96a24: Add the per-request LLM client resolver (GAP-360 PR-2). `resolveLLMClientForRequest`
  is the single home for key resolution at every agent-dispatch site: per-user BYOK
  first, then site-level inference config, then deployment env on self-hosted only.
  On hosted, an unconfigured account fails closed with a typed `LLMNotConfiguredError`
  (HTTP 409 naming `/settings/api-keys`) instead of silently falling through to the
  localhost default. Gated behind `HOSTED_BYOK_DISPATCH` so self-hosted env-first
  behavior is byte-unchanged. `createLLMClientForUser` gains a `hostedViableOnly`
  option; `generateEmbedding` accepts an optional pre-resolved client. Emits a
  one-time operator warning when the hosted BYOK dispatch flag is explicitly
  disabled (every account shares the deployment env client while the lever is
  pulled).

  Security fix (guardrail-2): the durable worker now derives dispatch identity
  from the authenticated dispatcher captured server-side at enqueue time, never
  from `ticket.reporterId` — that column is client-writable via the general
  tickets API with no ownership check, so reading it for key resolution would
  let an attacker who owns a board decrypt a victim's BYOK key by planting the
  victim's user id in `reporterId` before dispatching.

- 76efd75: Widen the LLM provider surface with Anthropic and OpenAI (no behavior change).

  `@revealui/ai`: `LLMProviderType` now includes `anthropic` and `openai`, added to
  the `createProvider` factory as OpenAI-compatible wrappers (Anthropic at
  `https://api.anthropic.com/v1`, OpenAI at `https://api.openai.com/v1`) with
  conservative default models. Fixes a latent defect where `huggingface` was
  accepted by the env factory but had no `createProvider` case and threw at first
  use. `createLLMClientFromEnv` auto-detects the two new providers after the
  existing checks so existing deployments resolve identically, and now emits the
  one-line boot warning it always documented when the zero-config localhost default
  is selected. The OpenAI-compatible client sets a 60s request timeout and one
  retry so an unreachable endpoint fails fast instead of burning the serverless
  duration. Exports a `hostedViable` classification for later resolver/UI wiring.

  `@revealui/db`: migration widening the provider CHECK constraints on
  `user_api_keys` and `workspace_inference_configs` (and the latter's key-pairing
  CHECK) to allow `anthropic` and `openai`. Constraint-widening only, idempotent,
  no backfill.

### Patch Changes

- Updated dependencies [eac1a1b]
- Updated dependencies
- Updated dependencies [0cc7f62]
- Updated dependencies [76efd75]
  - @revealui/db@0.8.0
  - @revealui/core@0.11.1
  - @revealui/contracts@0.7.0

## 0.6.4

### Patch Changes

- Updated dependencies [dc3e318]
- Updated dependencies [4778037]
- Updated dependencies [9801744]
- Updated dependencies [639dfa5]
  - @revealui/core@0.11.0
  - @revealui/contracts@0.6.2
  - @revealui/db@0.7.3

## 0.6.3

### Patch Changes

- Updated dependencies [6ac1c0d]
  - @revealui/core@0.10.2
  - @revealui/db@0.7.2
  - @revealui/contracts@0.6.1

## 0.6.2

### Patch Changes

- 07b1c8b: `useAgentStream` now decodes the `revealui-csrf` cookie value before forwarding it as the `X-CSRF-Token` header. Next.js encodes cookie values with `encodeURIComponent` (via the `cookie` package), storing and returning the nonce:hmac string as `nonce%3Ahmac`; the admin proxy's `validateCsrfToken` calls `indexOf(':')` which finds nothing in the encoded form and returns false — the hook's POST requests were rejected with a 403 "CSRF token invalid" even when a valid session and correct token were present. The fix applies `decodeURIComponent` with a `try/catch` fallback to the raw value on `URIError`, matching the fix applied to all other CSRF readers in the same release cycle (#1405). No API change: callers without the cookie continue to send requests byte-identical to before.

## 0.6.1

### Patch Changes

- Updated dependencies [ff8096d]
- Updated dependencies [ed45978]
  - @revealui/core@0.10.1

## 0.6.0

### Minor Changes

- 2f1c551: `useAgentStream` now echoes the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues) as an `X-CSRF-Token` header on both of its POSTs, `start()` and `submitElicitation()`. The API server's CSRF middleware requires that header on any session-cookie-bearing unsafe request, so cookie-authenticated browser consumers of the hook would otherwise 403 once CSRF enforcement is active. Mirrors the cookie-read in `@revealui/core`'s admin APIClient. No API change: when the cookie is absent (API-key / server-to-server callers, non-browser environments) the header is omitted and requests are unchanged.

### Patch Changes

- Updated dependencies [553a981]
- Updated dependencies [763e4f1]
- Updated dependencies [ebbe445]
- Updated dependencies [c77ac4f]
- Updated dependencies [a3dcac3]
- Updated dependencies [8024933]
  - @revealui/core@0.10.0
  - @revealui/contracts@0.6.1
  - @revealui/db@0.7.1

## 0.5.2

### Patch Changes

- Updated dependencies [96b1049]
- Updated dependencies [e08adbe]
- Updated dependencies [f8c74e6]
- Updated dependencies [ba61b20]
- Updated dependencies [6545491]
  - @revealui/db@0.7.0
  - @revealui/core@0.9.0
  - @revealui/contracts@0.6.0

## 0.5.1

### Patch Changes

- 95aac35: Fix `test_runner` leaking the test process tree on timeout.

  The tool ran tests via `execSync(..., { timeout })`, whose timeout signal only reaches the immediate child (the shell). A grandchild — e.g. `pnpm test` → `node …` — was orphaned and kept running. An agent pointing `test_runner` at a hanging suite leaked a process on every timeout; in the unit suite these orphans accumulated and starved CI, flaking the timeout test and crashing sibling test files under load.

  `execute` now spawns the command detached (its own process group) and, on timeout, kills the whole group via `process.kill(-pid, 'SIGKILL')` — reaping the entire tree. Output capture is byte-capped instead of throwing on overflow. Behavior is otherwise unchanged: framework detection, command building, and result parsing are identical, and a real timeout still returns `{ success: false, error: 'Tests timed out after …' }`.

  Verified: full `@revealui/ai` suite passes 942/942 twice under concurrent load with zero leaked processes (previously 1 failed + 3 file-level crashes + 18 orphaned `node` processes).

- Updated dependencies [198fc08]
- Updated dependencies [9ec7c07]
- Updated dependencies [363d4b5]
- Updated dependencies [198e56a]
- Updated dependencies [1d5a9e4]
- Updated dependencies [e4a3779]
- Updated dependencies [6643d0b]
  - @revealui/core@0.8.0
  - @revealui/contracts@0.6.0
  - @revealui/db@0.6.0

## 0.5.0

### Minor Changes

- 28dcf4c: `createLLMClientFromEnv()` now ships a default `baseURL` for the `inference-snaps` provider — `http://localhost:9090/v1`, matching Canonical's standard Inference Snap port — so a user who sets `LLM_PROVIDER=inference-snaps` but omits `INFERENCE_SNAPS_BASE_URL` hits the local snap without further configuration. Existing deployments that already set `INFERENCE_SNAPS_BASE_URL` are unchanged (env override still wins). Mirrors the existing Ollama default (`http://localhost:11434`).

  Also:

  - JSDoc now lists `inference-snaps → gemma3` alongside Ollama and Groq in the "Provider defaults" block and names Canonical Inference Snaps as the reference local provider on Ubuntu.
  - The "No LLM provider configured" error message now leads with `INFERENCE_SNAPS_BASE_URL` before Ollama and Groq, with a pointer to the provider module's install docs.

  Fulfills the Canonical-Inference-Snap-as-reference-provider Stage 5.1/5.2 goal ("ship a documented preset out of the box"). No behavior change for explicit `INFERENCE_SNAPS_BASE_URL` users; no change to auto-detection precedence (still `INFERENCE_SNAPS → GROQ → OLLAMA`).

- a824f0f: A2A handler now emits `pending-payment` task state when the resolved
  agent definition has a `pricing` field AND no payment proof was verified
  upstream by the route. The HTTP layer (`apps/server/src/routes/a2a.ts`)
  verifies `X-PAYMENT-PAYLOAD` headers before calling the handler, sets
  `{ paymentVerified: true }` on success, and converts `pending-payment`
  states into HTTP 402 responses with `X-PAYMENT-REQUIRED` headers (using
  the existing `buildPaymentRequired` + `encodePaymentRequired` middleware
  primitives).

  Pricing rides on `task.metadata.pricing` so the route can build the 402
  body without re-querying the agent registry. Tasks in the
  `pending-payment` state are cancelable so a requester who decides not to
  pay can release the task slot.

  `handleA2AJsonRpc` and `handleTasksSend` gain an optional
  `options?: { paymentVerified?: boolean }` 4th parameter (backward
  compatible — falsy by default). USDC remains the primary settlement
  currency; RVUI is gated behind `RVUI_PAYMENTS_ENABLED=false` in prod
  pending the safeguards-pipeline fix tracked separately.

  Part of the GAP-149 (x402 / A2A wiring) sequence — PR 2 of N.

- 7ad9ddb: Remove unused `checkAiLicense` export. Per the 2026-05-08 charge-readiness audit
  Phase 2 Path A: the function was theater — declared but never called by any feature
  code in `src/`. The FSL-1.1-MIT non-compete is the real legal protection; npm-package
  DRM is a multi-week arms race that customers route around in an afternoon. Drop the
  gate, strip the `[Pro]` description prefix to match enforcement reality.

  The `@revealui/core` license JWT layer (`initializeLicense` / `isLicensed` /
  `requireFeature`) is unchanged — it remains genuinely useful for tier-aware feature
  shaping in the hosted product (revealui.com), where we control the runtime.

- 73ce692: A.2b-backend of the post-v1 MCP arc — wire Stage 5.3 elicitation handler
  into agent-stream + emit side-channel SSE chunks for
  sampling/elicitation. The backend plumbing the A.2b-frontend UI will sit
  on top of.

  When an MCP server connected to an in-flight `/api/agent-stream` run
  calls `elicitation/create`, the handler now:

  1. Writes an `elicitation_request` chunk to the SSE stream with
     `{ sessionId, elicitationId, requestedSchema, message, namespace }`.
  2. Parks on the in-memory agent-run session registry until a matching
     `POST /api/agent-stream/elicit` resolves the pending promise.
  3. Returns the user's decision to the MCP server so the tool call can
     continue.

  Sampling requests (wired in A.2a) now also emit a `sampling_request`
  chunk before running the LLM for observability.

  **`@revealui/ai`:**

  - Extend `AgentStreamChunk` with three side-channel types:
    `session_info`, `sampling_request`, `elicitation_request`. Adds
    `sessionId`, `namespace`, `sampling`, and `elicitation` optional
    fields to carry side-channel payloads. Runtime-level emission is
    unchanged — the generator still yields only the core turn events
    (`text`, `tool_call_start`, `tool_call_result`, `error`, `done`).
    Side-channel chunks are written directly by route-level handlers.

  **`api`:**

  - `apps/server/src/lib/agent-run-sessions.ts` (new) — process-local
    registry of `(sessionId, elicitationId) → pending Promise<ElicitResult>`.
    Adapted from Stage 3.4's admin-side `call-sessions.ts`, scoped to
    agent-run lifecycle rather than per-tool-invocation. Exports:
    `createAgentRunSession`, `getAgentRunSession`, `awaitElicitationResponse`,
    `resolveElicitation`, `deleteAgentRunSession` (plus a test-only
    `_resetAgentRunSessions`).
  - `apps/server/src/routes/agent-stream-elicit.ts` (new) —
    `POST /api/agent-stream/elicit` endpoint. Body
    `{ sessionId, elicitationId, action: 'accept'|'decline'|'cancel',
content? }`. Enforces `session.userId === c.var.user.id`. 404 on
    unknown session or elicitation id; 403 on user mismatch; 401 on
    unauthenticated.
  - `apps/server/src/routes/agent-stream.ts` —
    - Create `runSession = createAgentRunSession(user.id)` before
      MCP-client construction; tear down in the streamSSE `finally`.
    - Declare `streamRef: { current: SSEStreamingApi | undefined }` as a
      late-binding mutable reference so per-server elicitation/sampling
      handlers (built before `streamSSE()` starts) can write into the
      stream once it exists.
    - Wrap the A.2a sampling handler with a chunk-emit wrapper writing a
      `sampling_request` chunk before calling the inner handler.
    - Build a per-server `elicitationHandler` that writes an
      `elicitation_request` chunk + parks on the run-session registry;
      falls back to `{ action: 'cancel' }` when the stream isn't yet
      bound or when the registry entry disappears mid-flight.
    - First SSE chunk is `session_info` so the client learns the
      `sessionId` to POST back to `/api/agent-stream/elicit`.
  - `apps/server/src/index.ts` — mount the new route at
    `/api/agent-stream/elicit` (canonical + `/api/v1/…` alias), before
    the parent `/api/agent-stream` mount so the trie-based router matches
    the more-specific prefix first. CSRF (`writeProtected`) applied to
    the new POST.

- 602a906: A.2b-frontend of the post-v1 MCP arc — first user-visible Stage 5 surface.

  New `/admin/agents/[agentId]/run` page consumes the `/api/agent-stream`
  SSE backend (A.1 + A.2a + A.2b-backend) and renders chunks live: tool
  calls, sampling requests, and inline elicitation forms. Mid-run when a
  connected MCP server requests user input via `elicitation/create`, the
  page renders an inline form derived from `requestedSchema` and POSTs the
  response to `/api/agent-stream/elicit` (A.2b-backend's endpoint).

  **`@revealui/ai`:**

  - Extend `useAgentStream` (`packages/ai/src/client/hooks/useAgentStream.ts`)
    with the three side-channel chunk types from A.2b-backend (`session_info`,
    `sampling_request`, `elicitation_request`) plus the optional payload
    fields (`sessionId`, `namespace`, `sampling`, `elicitation`).
  - Track `sessionId` in hook state when the leading `session_info` chunk
    arrives. Track outstanding form-mode elicitation requests in
    `pendingElicitations` (a `PendingElicitation[]`).
  - New `submitElicitation(elicitationId, action, content?)` method —
    POSTs to `/api/agent-stream/elicit` with the resolved `sessionId` +
    removes the entry from `pendingElicitations` on success. Throws if
    called before `start()` resolves a sessionId, or if the server
    returns non-2xx.
  - Pure `applyChunk(state, chunk)` reducer extracted for test-friendliness
    - exported as `_applyChunkForTesting`. Pending elicitations are
      cleared on `done`/`error` so stale forms don't sit on screen after the
      stream tears down.
  - 12 new tests covering the chunk reducer + the submitElicitation
    round-trip + error paths. `@revealui/ai` 951 → 963 passing.

  **`admin`:**

  - New page `apps/admin/src/app/(backend)/admin/agents/[agentId]/run/page.tsx`.
    Submit-an-instruction form, status bar (streaming/idle/error +
    sessionId + chunk count), pending-elicitations stack rendered as
    inline forms, accumulated `text` panel, full event log with
    per-event-type rows. Cancel button uses `useAgentStream.abort`. Reset
    clears state for a fresh run.
  - Extracted `ElicitationForm` + `ArgumentField` from Stage 3.4's
    `StreamingToolCard` into a new shared component
    `apps/admin/src/lib/components/mcp/elicitation-form.tsx`. The form
    now accepts a flat `(message, requestedSchema, onSubmit)` shape so
    it's reusable across the inspector flow and the agent-run flow.
    `StreamingToolCard` updated to import the extracted component;
    zero behavior change for the inspector. The Stage 3.4 inspector
    tests stay green.
  - Added a "Watch live ↗" link button to the Task Tester card on the
    agent detail page (`page.tsx`), routing to the new `/run` page.
    `TaskTester` itself unchanged — coexists as a polling A2A fallback.

  **Discipline notes:**

  - Boundary validation continues to pass — admin imports `useAgentStream`
    via the `@revealui/ai/client/hooks/useAgentStream` subpath which is
    already the existing module path; no new static imports of
    `@revealui/ai` from admin code.
  - `pendingElicitations` is cleared on `done` and `error` so a stream
    teardown can't leave a phantom form on screen — matches the
    registry's `deleteAgentRunSession` cancel-on-cleanup semantics.
  - Malformed `requestedSchema` (e.g. missing `properties`) degrades to
    an empty-fields form rather than a render error; user can still
    decline/cancel.

- 6ce0d60: A.3a of the post-v1 MCP arc — backend for the `/admin/mcp` Usage tab.

  The accompanying A.3b PR adds the admin UI on top of this; A.3a lands
  the schema migration + sink-side population + aggregation endpoint
  independently so the UI can ship against a stable backend.

  **`@revealui/db`:**

  - Migration `0011_usage_meters_duration_ms.sql` adds two nullable
    columns to `usage_meters`: `duration_ms` (bigint) + `errored`
    (boolean). Pre-A.3 rows carry NULL; post-migration rows populate
    from the Stage 6.1/6.2 sinks.
  - Drizzle schema mirror in `accounts.ts`.

  **`@revealui/ai`:**

  - Extend `McpUsageMeterRow` with `durationMs?: number` + `errored?: boolean`.
  - `createUsageMeterSink` populates both from `event.duration_ms` /
    `!event.success` so existing consumers automatically capture the
    new fields once the schema accepts them.

  **`api`:**

  - New `GET /api/mcp/usage?range=24h|7d|30d` endpoint that aggregates
    per-`meterName` totals + success/error/unknown counts +
    p50/p95 duration via PostgreSQL `percentile_disc`. Filters by
    `entitlementMiddleware`-resolved `accountId` (account-scoped, same
    precedent as A.1's metering writer). Mounted at canonical +
    `/api/v1/...` paths.
  - 9 PGlite-backed integration tests cover auth, accountId scoping,
    per-meter aggregation, percentile correctness, range filtering,
    and zod validation.

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
- Updated dependencies [b0bab95]
- Updated dependencies [3ff25bb]
- Updated dependencies [af12683]
- Updated dependencies [972b052]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [6ce0d60]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/core@0.7.0
  - @revealui/db@0.5.0

## 0.3.0

### Minor Changes

- 1f2d9b2: Expose two previously internal-but-documented modules as public subpath imports:

  - `@revealui/ai/a2a` — agent card registry, JSON-RPC handler, and task-store helpers (`agentCardRegistry`, `handleA2AJsonRpc`, `createTask`, `cancelTask`, `getTask`, `appendArtifact`, etc.)
  - `@revealui/ai/orchestration/runtime` — non-streaming `AgentRuntime` (complement to the existing `./orchestration/streaming-runtime`)

  Both modules have existed in source and dist for multiple releases but were not listed in `package.json#exports`. `docs/AI.md` references them directly.

  Duplicates the `./orchestration/runtime` entry added in the pending AI prompt-caching PR — merge order agnostic, the entries are identical.

- 4bb1466: Add subpath exports for AI caching, orchestration, and skills registry helpers:

  - `@revealui/ai/llm/cache-utils` — `withCache`, `cacheableSystemPrompt`, and related prompt-caching helpers
  - `@revealui/ai/llm/response-cache` — `getGlobalResponseCache`, `calculateResponseCacheSavings`
  - `@revealui/ai/llm/semantic-cache` — `getGlobalSemanticCache`, `calculateSemanticCacheSavings`
  - `@revealui/ai/orchestration/runtime` — non-streaming agent runtime (complement to the existing `./orchestration/streaming-runtime`)
  - `@revealui/ai/skills/registry` — `globalSkillRegistry`, `SkillRegistry`, `SkillStorageConfig`

  Docs under `docs/ai/PROMPT_CACHING.md`, `docs/ai/RESPONSE_CACHING.md`, and `docs/ai/SEMANTIC_CACHING.md` reference these paths; they previously resolved only via deep relative paths.

- 2204021: Remove the legacy log-redaction duplicates in favor of the audited `@revealui/security` chokepoint.

  - `@revealui/core`: `sanitizeLogData` (exported from `@revealui/core/observability/logger`) is gone. Replace with `redactLogContext` from `@revealui/security` — same intent, broader coverage (recurses into arrays, scrubs inline secret shapes in string values, depth-capped at 8).
  - `@revealui/ai`: `redactSensitiveFields` (exported from `@revealui/ai/llm/client`) is gone. Replace with `redactLogContext` from `@revealui/security`.

  Behavior is strictly broader, not narrower, so existing redactions continue to fire. Consumers that relied on arrays being passed through unredacted will now see array members walked.

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [284fd1f]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [59c670b]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/core@0.6.0
  - @revealui/db@0.4.0
  - @revealui/contracts@1.4.0

## 0.2.9

### Patch Changes

- Complete CRDT implementation with sync, replay, and GC. MCP default reply-to from env var. Autonomous agent architecture phases 2-3.
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.7
  - @revealui/core@0.5.6
  - @revealui/contracts@1.3.7

## 0.2.8

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

## 0.2.7

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5

## 0.2.6

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3
  - @revealui/db@0.3.4

## 0.2.4

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3
  - @revealui/core@0.5.2

## 0.2.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2
  - @revealui/core@0.5.1

## 0.2.2

### Patch Changes

- Updated dependencies
  - @revealui/core@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

## 0.2.0

### Minor Changes

- Add `restDb` parameter to IngestionPipeline constructor for dual-database support (Neon + Supabase vector store).

  BREAKING: `IngestionPipeline` now takes 3 arguments `(db, restDb, embeddingFn)` instead of 2 `(db, embeddingFn)`.
