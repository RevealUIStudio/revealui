---
'@revealui/mcp': minor
---

A.2a of the post-v1 MCP arc — wire Stage 5.2 sampling handler into agent-stream.

When an OAuth-authorized MCP server connected to an agent run at
`/api/agent-stream` requests `sampling/create`, the handler now routes the
request through the configured LLM (defaulting to Canonical Inference Snap
via `INFERENCE_SNAPS_BASE_URL` env precedence). Model-hint allowlist guards
against servers routing us to expensive models.

**`@revealui/mcp`:**
- `BuildRemoteMcpClientOptions.samplingHandler?: SamplingHandler` — new
  pass-through slot on `buildRemoteMcpClient` that forwards to the
  `McpClient` constructor (the slot already existed on `McpClient`; A.2a
  exposes it to callers via `@revealui/mcp/remote-client`).

**`api`:**
- `apps/api/src/routes/agent-stream.ts` — per connected MCP server, build
  a sampling handler via `aiMod.createSamplingHandler({ llm: llmClient,
  allowedModels, defaultModel, namespace: server, onEvent })` and pass
  to `buildRemoteMcpClient`. Same `onEvent` sink as A.1's tool adapters,
  so Stage 6.1 logger + Stage 6.2 `usage_meters` capture
  `mcp.sampling.create` events alongside tool calls.
