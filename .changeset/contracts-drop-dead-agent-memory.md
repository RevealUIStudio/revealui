---
'@revealui/contracts': patch
---

Drop the 710-line dead parallel `AgentMemory` implementation at `packages/contracts/src/entities/agent-memory.ts` (and its barrel re-exports from `entities/index.ts`). The canonical AgentMemory shape lives at `packages/contracts/src/agents/index.ts` and is what every production caller (14+ in `@revealui/ai`) actually imports — `from '@revealui/contracts/agents'` (or via the top-level `@revealui/contracts` re-export, which already points at the agents path). The `entities/agent-memory.ts` implementation was a richer but unused parallel design with `Date` objects, lifecycle helpers, computed views, etc.; verified zero production imports of any `AgentMemory*` symbol via the `@revealui/contracts/entities` subpath. Closes GAP-135.
