---
'@revealui/ai': minor
---

Expose two previously internal-but-documented modules as public subpath imports:

- `@revealui/ai/a2a` — agent card registry, JSON-RPC handler, and task-store helpers (`agentCardRegistry`, `handleA2AJsonRpc`, `createTask`, `cancelTask`, `getTask`, `appendArtifact`, etc.)
- `@revealui/ai/orchestration/runtime` — non-streaming `AgentRuntime` (complement to the existing `./orchestration/streaming-runtime`)

Both modules have existed in source and dist for multiple releases but were not listed in `package.json#exports`. `docs/AI.md` references them directly.

Duplicates the `./orchestration/runtime` entry added in the pending AI prompt-caching PR — merge order agnostic, the entries are identical.
