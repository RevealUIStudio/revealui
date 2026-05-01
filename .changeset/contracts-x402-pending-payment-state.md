---
'@revealui/contracts': minor
---

Add `pending-payment` state to `A2ATaskStateSchema` and optional `pricing: { usdc, rvui? }` field to `AgentDefinitionSchema`. Schema-only PR 1 of GAP-149 (x402 A2A wiring); the new state and field are not yet emitted or consumed at runtime — PR 2 wires the A2A handler to emit on first call without proof and accept proof-of-payment headers.
